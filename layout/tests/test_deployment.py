import asyncio

from carthage import InjectionKey, Machine
from carthage.dependency_injection.base import InjectionFailed
from carthage.pytest import TestTiming, async_test
from httpx import ASGITransport, AsyncClient
import pytest

'''
Integration tests that require sudo/CAP_NET_ADMIN and fully instantiate networks, machines and containers.
'''


DEPLOYMENT_TEST_TIMEOUT = 900.0

async def wait_for_completed_deployment(client: AsyncClient, timeout: float = DEPLOYMENT_TEST_TIMEOUT):
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    last_body = None
    while True:
        response = await client.get("/api/v1/deployment-status")
        assert response.status_code == 200
        body = response.json()
        if body is not None:
            last_body = body
            if not body["running"]:
                return body
        if loop.time() >= deadline:
            raise AssertionError(f"deployment did not complete before timeout; last status: {last_body!r}")
        await asyncio.sleep(0.25)


@async_test
async def test_deployment_status_starts_empty(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/deployment-status")

    assert response.status_code == 200
    assert response.json() is None


@async_test
async def test_deploy_endpoint_wires_through(app):
    with TestTiming(DEPLOYMENT_TEST_TIMEOUT):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/deploy")
            assert response.status_code == 200

            status = await wait_for_completed_deployment(client)

    assert status["running"] is False
    assert status["failures"] == []
    assert status["dependency_failures"] == []
    assert status["successes"]


def test_layout_vm_image_factory_raises_when_pending(layout, loop):
    with pytest.raises(InjectionFailed) as excinfo:
        loop.run_until_complete(
            layout.ainjector.get_instance_async(InjectionKey(Machine, host="tester01"))
        )

    assert isinstance(excinfo.value.__cause__, FileNotFoundError)
    assert "VM image not present" in str(excinfo.value.__cause__)
