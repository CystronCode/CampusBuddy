import asyncio
import json
import os
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def demo():
    params = StdioServerParameters(
        command=sys.executable, args=["-m", "backend.app.mcp_server"], env=dict(os.environ)
    )
    results = []
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            for name, args in [
                ("get_next_class", {}),
                ("search_canteen_items", {"budget": 100, "vegetarian": True}),
                ("search_documents", {"query": "internal assessment circular"}),
            ]:
                result = await session.call_tool(name, args)
                results.append(
                    {
                        "tool": name,
                        "error": bool(result.isError),
                        "content": [c.text for c in result.content if hasattr(c, "text")],
                    }
                )
    return {"tools_discovered": len(tools.tools), "calls": results}


if __name__ == "__main__":
    print(json.dumps(asyncio.run(demo()), indent=2))
