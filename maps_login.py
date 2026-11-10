"""Run once:  python maps_login.py
Opens Chrome with the same profile the pipeline uses. Sign in to Google, open Google Maps once,
then come back here and press Enter. The login is saved, so Maps shows the full view with Reviews.
Close the backend (uvicorn) first - a profile can only be open in one browser at a time."""
import os
from playwright.sync_api import sync_playwright

PROFILE = os.getenv("MAPS_PROFILE_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".maps_profile"))

with sync_playwright() as p:
    kw = dict(user_data_dir=PROFILE, headless=False, locale="en-US",
              viewport={"width": 1400, "height": 900},
              args=["--disable-blink-features=AutomationControlled"],
              ignore_default_args=["--enable-automation"])
    if os.getenv("PIPELINE_BROWSER_CHANNEL"):
        kw["channel"] = os.getenv("PIPELINE_BROWSER_CHANNEL")
    ctx = p.chromium.launch_persistent_context(**kw)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://accounts.google.com/", wait_until="domcontentloaded")
    input("Sign in to Google in the browser window, then press Enter here... ")
    page.goto("https://www.google.com/maps?hl=en", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    ctx.close()
print("Saved. You can start the backend now.")
