from functools import wraps
from typing import Any, Callable, Literal, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress, model_serializer, model_validator
from pathlib import Path
import yaml
from uuid import uuid4
''' Models representing objects that have been statically added to a
topology layout in the WHS. These are things that ultimately come from
the API users.
'''

__all__ = [
    'IdentifiedModel',
    'VmImage',
    'ContainerImage',
    'Device',
    'Pcap',
    'ModelStore',
]

default_model_config = ConfigDict(
        str_strip_whitespace=True,
        extra='forbid',
        validate_assignment=True,
    )


def export_serializer(fn: Callable[..., dict[str, Any]]) -> Callable[..., dict[str, Any]]:
    @wraps(fn)
    def wrapped(self, handler, info):
        data = handler(self)
        context = getattr(info, 'context', None) or {}
        store = context.get('store')
        if context.get('format') != 'export' or store is None:
            return data
        return fn(self, data, store)

    return wrapped

class IdentifiedModel(BaseModel):
    id: str

ModelType = TypeVar('ModelType', bound=IdentifiedModel)

class VmImage(IdentifiedModel):
    model_config = default_model_config
    id: str = Field(default_factory=lambda: uuid4().hex)

    name: str = Field(description='Name of the image', min_length=1, max_length=64)
    description: str = Field(description='Description or tags', default='')
    version: str = Field(description='Version name or number or both', default='', max_length=24)
    type: Literal['qcow2', 'raw'] = Field(description='Type of image being used, qcow2 or raw', default='raw')

    @model_serializer(mode='wrap')
    @export_serializer
    def serialize_for_export(self, data, store):
        del store
        data.pop('id', None)
        return data

class ContainerImage(IdentifiedModel):
    model_config = default_model_config
    id: str = Field(default_factory=lambda: uuid4().hex)

    name: str = Field(description='Name of the image', min_length=1, max_length=64)
    description: str = Field(description='Description or tags', default='')
    version: float = Field(default=1.00)

class Device(IdentifiedModel):
    model_config = default_model_config
    id: str = Field(default_factory=lambda: uuid4().hex)

    name: str = Field(description='Name of the device', min_length=3, max_length=20)
    description: str = Field(description='Description or tags', default='')
    type: Literal['vm', 'container'] = Field(description='Type of device, vm or container. Only vm is supported today.', default='vm')
    cloud_init: bool = Field(description='Use cloud init', default=True)

    architecture: Literal['x86_64', 'aarch64'] = Field(description='Architecture of the device, x86_64 or aarch64', default='x86_64')
    cpus: int = Field(description='Number of CPUs assigned', default=2)
    memory: int = Field(description='System memory (in MB) assigned', default=4096)
    disk: int = Field(description='Disk size (in MB)', default=20*1024)
    disk_controller: Literal['virtio', 'sata'] = Field(description='Controller used for disk', default='virtio')
    display: bool = Field(description='Display needed', default=False)

    # If no image_id is provided, maybe set a default image and/or allow for pulling from a container registry in the future
    image_id: Optional[str] = Field(description='Image id to use for the machine', default=None)

    dhcp: bool = Field(description='Leave True to use DHCP. If a static is desired, set this to False and set ipv4_manual, gateway, and dns_servers.', default=True)
    mac_address: Optional[str] = Field(description='Hardware MAC address', default=None, pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
    ipv4_manual: Optional[IPvAnyAddress] = Field(description='Static IP address', default=None)
    gateway: Optional[IPvAnyAddress] = Field(description='Default gateway', default=None)
    dns_servers: list[IPvAnyAddress] = Field(default_factory=list)

    @model_serializer(mode='wrap')
    @export_serializer
    def serialize_for_export(self, data, store):
        data.pop('id', None)
        image = store.get_device_image(self)
        if image:
            data.pop('image_id', None)
            if isinstance(image, ContainerImage):
                data['image'] = image.name
            else:
                data['image'] = {
                    'id': image.id,
                    'name': image.name,
                    'type': image.type
                }
        return data

    @model_validator(mode='before')
    @classmethod
    def import_from_yaml(cls, obj, info):
        if not isinstance(obj, dict):
            return obj

        data = dict(obj)
        try:
            format = info.context['format']
            store = info.context['store']
        except (KeyError, AttributeError, TypeError):
            return data
        if format != 'export':
            return data
        if 'image' in data:
            data['image_id'] = store.resolve_imported_image(device_type=data['type'], image=data['image'])
            del data['image']
        return data
    
class Pcap(IdentifiedModel):
    model_config = default_model_config
    id: str = Field(default_factory=lambda: uuid4().hex)

    name: str = Field(description='Name of the pcap', min_length=3, max_length=20)
    description: str = Field(description='Description or tags', default='')

    @model_serializer(mode='wrap')
    @export_serializer
    def serialize_for_export(self, data, store):
        del store
        data.pop('id', None)
        return data

class ModelStore(BaseModel):
    model_config = default_model_config

    vm_images: dict[str, VmImage] = Field(default_factory=dict)
    container_images: dict[str, ContainerImage] = Field(default_factory=dict)
    devices: dict[str, Device] = Field(default_factory=dict)
    pcaps: dict[str, Pcap] = Field(default_factory=dict)
    model_dir: Path = Field(default=Path(__file__).with_name('models'))

    def _load_model_file(self, path: Path, model_class: type[ModelType]) -> dict[str, ModelType]:
        if not path.exists():
            return {}

        with path.open('r', encoding='utf-8') as f:
            raw_data = yaml.safe_load(f)

        if raw_data is None:
            return {}
        if not isinstance(raw_data, dict):
            raise ValueError(f'Expected a mapping of id -> record in {path}')

        records: dict[str, ModelType] = {}
        for record_id, item in raw_data.items():
            if not isinstance(item, dict):
                raise ValueError(f'Expected record {record_id} in {path} to be a mapping')

            payload = {'id': record_id, **item}
            record = model_class.model_validate(payload)
            records[record_id] = record

        return records

    def _save_model_file(self, path: Path, records: dict[str, ModelType]) -> None:
        with path.open('w', encoding='utf-8') as f:
            yaml.safe_dump(
                {
                    record_id: {
                        key: value
                        for key, value in record.model_dump(mode='json', by_alias=True).items()
                        if key != 'id'
                    }
                    for record_id, record in records.items()
                },
                f,
                sort_keys=False,
                default_flow_style=False,
            )

    def resolve_imported_image(self, device_type: str, image: Any) -> str:
        if device_type == 'container':
            if not isinstance(image, str):
                raise ValueError(f'Container device image must be a name string, got {type(image).__name__}')
            for container_image in self.container_images.values():
                if container_image.name == image:
                    return container_image.id
            synthesized_image = ContainerImage(name=image)
            self.container_images[synthesized_image.id] = synthesized_image
            return synthesized_image.id

        if device_type != 'vm':
            raise ValueError(f'Unsupported device type {device_type!r}')

        if not isinstance(image, dict):
            raise ValueError(f'VM device image must be a mapping, got {type(image).__name__}')

        image_id = image.get('id')
        if image_id is not None:
            if image_id in self.vm_images:
                return image_id
            raise ValueError(f'No vm image with id {image_id!r} exists in the model store')

        image_name = image.get('name')
        image_type = image.get('type')
        for vm_image in self.vm_images.values():
            if vm_image.name == image_name and vm_image.type == image_type:
                return vm_image.id
        raise ValueError(f'No vm image matching name={image_name!r} type={image_type!r} exists in the model store')

    def load(self) -> 'ModelStore':
        '''Loads models from yaml'''
        self.vm_images = self._load_model_file(self.model_dir / 'vm_images.yml', VmImage)
        self.container_images = self._load_model_file(self.model_dir / 'container_images.yml', ContainerImage)
        self.devices = self._load_model_file(self.model_dir / 'devices.yml', Device)
        self.pcaps = self._load_model_file(self.model_dir / 'pcaps.yml', Pcap)
        return self

    def save(self) -> 'ModelStore':
        '''Saves all models off to yaml'''
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.validate_references()

        self._save_model_file(self.model_dir / 'vm_images.yml', self.vm_images)
        self._save_model_file(self.model_dir / 'container_images.yml', self.container_images)
        self._save_model_file(self.model_dir / 'devices.yml', self.devices)
        self._save_model_file(self.model_dir / 'pcaps.yml', self.pcaps)
        return self

    def export_yaml(self) -> str:
        self.validate_references()
        return yaml.safe_dump(
            self.model_dump(
                mode='json',
                context={'format': 'export', 'store': self},
                exclude={'container_images', 'model_dir'},
            ),
            sort_keys=False,
            default_flow_style=False,
        )

    def import_yaml(self, yaml_data: str) -> 'ModelStore':
        raw_data = yaml.safe_load(yaml_data)
        if raw_data is None:
            return self
        if not isinstance(raw_data, dict):
            raise ValueError('Expected exported model store YAML to be a mapping')

        vm_images = raw_data.get('vm_images', {})
        if not isinstance(vm_images, dict):
            raise ValueError('Expected vm_images to be a mapping')
        for image_id, payload in vm_images.items():
            if not isinstance(payload, dict):
                raise ValueError(f'Expected vm_images[{image_id!r}] to be a mapping')
            self.vm_images[image_id] = VmImage.model_validate(
                {'id': image_id, **payload},
                context={'format': 'export', 'store': self},
            )

        container_images = raw_data.get('container_images', {})
        if not isinstance(container_images, dict):
            raise ValueError('Expected container_images to be a mapping')
        for image_id, payload in container_images.items():
            if not isinstance(payload, dict):
                raise ValueError(f'Expected container_images[{image_id!r}] to be a mapping')
            self.container_images[image_id] = ContainerImage.model_validate(
                {'id': image_id, **payload},
                context={'format': 'export', 'store': self},
            )

        devices = raw_data.get('devices', {})
        if not isinstance(devices, dict):
            raise ValueError('Expected devices to be a mapping')
        for device_id, payload in devices.items():
            if not isinstance(payload, dict):
                raise ValueError(f'Expected devices[{device_id!r}] to be a mapping')
            record = Device.model_validate(
                {'id': device_id, **payload},
                context={'format': 'export', 'store': self},
            )
            self.devices[record.id] = record

        pcaps = raw_data.get('pcaps', {})
        if not isinstance(pcaps, dict):
            raise ValueError('Expected pcaps to be a mapping')
        for pcap_id, payload in pcaps.items():
            if not isinstance(payload, dict):
                raise ValueError(f'Expected pcaps[{pcap_id!r}] to be a mapping')
            self.pcaps[pcap_id] = Pcap.model_validate(
                {'id': pcap_id, **payload},
                context={'format': 'export', 'store': self},
            )

        self.validate_references()
        return self

    def get_device_image(self, device: Device) -> Optional[VmImage | ContainerImage]:
        '''Helper to get the actual image for a specific device.'''
        if not device.image_id:
            return None

        match device.type:
            case 'vm':
                return self.vm_images.get(device.image_id)
            case 'container':
                return self.container_images.get(device.image_id)
            case _:
                return None
    
    def validate_references(self):
        '''Ensures any referenced images actually exist'''
        for device in self.devices.values():
            if device.image_id and not self.get_device_image(device):
                raise ValueError(f"Device {device.name} references a missing image: {device.image_id}")



# For testing purposes
if __name__ == '__main__':
    test_image = VmImage(
        name = 'sdr_img',
        description = 'Siemens Digital Radiography',
        version = "v13.37",
        type = 'qcow2',
    )
    test_device = Device(
        name = 'tester01',
        description = 'Test device information',
        cpus = 4,
        image_id = test_image.id,
    )
    test_pcap = Pcap(
        name='test_pcap',
        description = 'Test pcap'
    )
    test_store = ModelStore(
        vm_images = {test_image.id: test_image},
        devices = {test_device.id: test_device},
    )
    test_store.save()
    loaded_store = ModelStore().load()
    print(loaded_store.model_dump())
