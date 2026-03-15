import asyncio
import gzip
import json
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


def decode_response_body(body: bytes) -> str:
    """Handle gzip-compressed responses from AliExpress."""
    try:
        return gzip.decompress(body).decode("utf-8")
    except Exception:
        return body.decode("utf-8")


def parse_mtop_response(text: str) -> dict:
    """Strip the JSONP wrapper mtopjsonp1({...}) and return plain JSON."""
    text = text.strip()
    if text.startswith("mtopjsonp"):
        start = text.index("(") + 1
        end = text.rindex(")")
        text = text[start:end]
    return json.loads(text)


async def get_recommendation_data(item_url: str, hover_selector: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1680, "height": 800},
        )
        page = await context.new_page()

        # Shared result holder and event to signal when we have the right response
        target_data = {"result": None}
        found_event = asyncio.Event()

        async def on_response(response):
            # Fast URL pre-filter (sync, no await needed)
            if "recom-acs.aliexpress.com" not in response.url or "mtop.relationrecommend.aliexpressrecommend.recommend" not in response.url or found_event.is_set():
                return

            try:
                body = await response.body()
                text = decode_response_body(body)
                parsed = parse_mtop_response(text)

                # Validate body structure:
                # must have api == "mtop.relationrecommend.aliexpressrecommend.recommend"
                # and result[0].data.layoutInfo present
                api_name = parsed.get("api", "")
                data_object = parsed.get("data", [])

                if api_name.lower() != "mtop.relationrecommend.aliexpressrecommend.recommend":
                    return
                if not data_object:
                    return

                result_data = data_object.get('data')
                if "layoutInfo" not in result_data:
                    return
                if result_data.get("success") is not True:
                    return

                # All checks passed — store and signal
                target_data["result"] = result_data
                found_event.set()

            except Exception as e:  # noqa: BLE001
                print(f"Response parse error: {e}")

        page.on("response", on_response)

        try:
            await page.goto(item_url, wait_until="domcontentloaded")
            await asyncio.sleep(5)

            # --- dismiss popups ---
            for selector in [".pop-close-btn", '._24EHh']:
                try:
                    el = page.locator(selector)
                    await el.wait_for(state="visible", timeout=3000)
                    await el.click()
                    await asyncio.sleep(1)
                except Exception:  # noqa: BLE001
                    pass  # popup not present, continue

            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(2)

            # --- hover to trigger the API call ---
            await page.wait_for_selector(hover_selector, timeout=10000)
            await page.hover(hover_selector)

            # Wait until the async response handler signals it found the right response
            await asyncio.wait_for(found_event.wait(), timeout=15)

            return target_data["result"]

        except PlaywrightTimeout:
            print("API call was not triggered — check your selector or page state")
            return None

        finally:
            await browser.close()


def store_result(result: dict):
    tabs = result['categoryTabs']['items']
    normalized = []
    for tab in tabs:
        normalized.append(tab['id'])
    
    with open('categories.json', 'w') as j:
        j.write(json.dumps(normalized, indent=2))


if __name__ == "__main__":
    result = asyncio.run(get_recommendation_data(
        item_url="https://nl.aliexpress.com/?spm=a2g0o.categorymp.logo.1.37c28WcW8WcWug",
        hover_selector='[class="Categoey--categoryTitle--_3bKGRN"]',
    ))
    print(json.dumps(result, indent=2))
    if result:
        store_result(result)
