import httpx
import json
import os
from typing import Any, Dict, List, Optional, Union

class TokenTalosClient:
    """
    Python client for TokenTalos Gateway.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        project_id: str = "default"
    ):
        self.api_url = api_url or os.getenv("TOKENTALOS_URL", "http://localhost:8060/api/v1")
        self.api_key = api_key or os.getenv("TOKENTALOS_API_KEY")
        self.project_id = project_id
        
        # Ensure URL doesn't end with a slash for easier path joining
        if self.api_url.endswith("/"):
            self.api_url = self.api_url[:-1]

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-TokenTalos-Key"] = self.api_key
        return headers

    async def execute(
        self,
        parts: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        endpoint: Optional[str] = None,
        project_id: Optional[str] = None,
        bypass_cache: bool = False
    ) -> Dict[str, Any]:
        """
        Execute a prompt through TokenTalos Gateway.
        """
        url = f"{self.api_url}/usage/execute"
        if bypass_cache:
            url += "?bypassCache=true"

        payload = {
            "parts": parts,
            "options": options or {},
            "projectId": project_id or self.project_id,
        }
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model
        if endpoint:
            payload["endpoint"] = endpoint

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()

    async def construct(
        self,
        parts: Dict[str, Any],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        endpoint: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Construct a prompt through TokenTalos Gateway without execution.
        """
        url = f"{self.api_url}/usage/prompt/construct"
        
        payload = {
            "parts": parts,
            "projectId": project_id or self.project_id,
        }
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model
        if endpoint:
            payload["endpoint"] = endpoint

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()

    async def ingest(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingest existing usage data into TokenTalos.
        """
        url = f"{self.api_url}/usage/ingest"
        
        # Ensure project_id is set if not provided in data
        if "projectId" not in data and "project_id" not in data:
            data["projectId"] = self.project_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=data,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()

    # Synchronous versions
    def execute_sync(self, *args, **kwargs) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self.execute(*args, **kwargs))

    def construct_sync(self, *args, **kwargs) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self.construct(*args, **kwargs))

    def ingest_sync(self, *args, **kwargs) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self.ingest(*args, **kwargs))

if __name__ == "__main__":
    # Simple test when run directly
    import asyncio
    
    async def test():
        client = TokenTalosClient(project_id="test_python_sdk")
        print(f"Testing TokenTalos Client at {client.api_url}")
        try:
            # We use a health check if available or just try a construct call
            result = await client.construct(
                parts={"system": "You are a tester.", "user_query": "Hello"},
                provider="gemini",
                model="gemini-3-flash-preview"
            )
            print("Successfully connected to TokenTalos!")
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Failed to connect: {e}")

    asyncio.run(test())
