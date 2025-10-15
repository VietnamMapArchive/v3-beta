from playwright.sync_api import Page, expect
import os

def test_app_fixes_mobile(page: Page):
    """
    This test verifies that the CORS issue and the hide sidebar button fix are working correctly on a mobile viewport.
    """
    # 1. Arrange: Set a mobile viewport size and go to the index.html page.
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(f"file://{os.getcwd()}/index.html")

    # 2. Assert: Confirm the sidebar toggle button is visible.
    sidebar_toggle_button = page.locator("#sidebar-toggle")
    expect(sidebar_toggle_button).to_be_visible()

    # 3. Assert: Confirm that the map data has loaded (by checking for the presence of the map selector options).
    map_selector = page.locator("#allmapsId")
    # Wait for the options to be populated, which indicates the JSON has been loaded and parsed.
    expect(map_selector.locator("option")).to_have_count.above(1, timeout=10000)

    # 4. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification-mobile-fixes.png")
