# macOS Menu Bar Apps: Best Practices (Industry Survey)

## Why menu bar apps are special
Menu bar apps are always-on, ambient utilities. They live in a very constrained UI area, are expected to be fast, and should not compete with core system UI. A great menu bar app feels like a lightweight extension of the system, not a full app squeezed into a tiny window.

## UX & Product Principles
1) **Use sparingly and keep your UI minimal**
   - Apple’s NSStatusBar documentation emphasizes that status items should be used sparingly because menu bar space is limited and items can be removed when space is constrained. This implies the UI must be compact, focused, and resilient to being hidden or removed by the system. (Source: NSStatusBar docs)
   - The legacy Apple Human Interface Guidelines (HIG) for “Menu Bar Extras” also underscore that menu bar items should be rare and not replicate existing system menus; use the menu bar when the feature is truly “ambient.” (Source: Apple HIG archive)

2) **Respect user control over menu bar items**
   - Apple’s support documentation shows that users can choose to show/hide menu bar items. Your app should not assume its icon is always visible and should provide alternative access (e.g., Spotlight, settings, or launch-on-login). (Source: Apple Support documentation)

3) **Small-window interaction patterns**
   - Standard menu bar apps open a small popover-like window anchored to the tray icon. The window should feel transient, dismissible, and should close when it loses focus (unless the user explicitly pins it). (Industry convention; supported by Electron’s tray/window examples)

4) **Provide a clear, minimal status indicator**
   - The tray icon should communicate a single clear status or action. If you need rich UI, open a small window rather than overloading the icon.

## Visual Design & Iconography
1) **Use template icons on macOS**
   - Electron’s Tray docs recommend template images for macOS so the system can automatically render the icon correctly in light/dark menu bars. Use a monochrome vector or template PNG. (Source: Electron Tray documentation)

2) **Retina and size correctness**
   - Use a vector (SVG) or provide multiple raster sizes (1x and 2x). Avoid blurry icons.

3) **Avoid complex color in the menu bar**
   - The menu bar is monochrome; colored icons look inconsistent and may fail accessibility contrast. Template icons solve this.

## Behavior & Window Management
1) **Keep the app running even when all windows are closed**
   - Electron’s tray tutorial shows the standard macOS pattern: don’t quit on window close; keep the app alive in the menu bar. (Source: Electron Tray tutorial)

2) **Click to toggle visibility**
   - Left-click typically toggles the popover window. Right-click can open a context menu for quick actions (preferences, quit, etc.).

3) **Positioning and edge handling**
   - Anchor the window below the menu bar icon, clamp to screen bounds, and handle multiple displays.

## Performance & Reliability
1) **Fast launch, fast open**
   - Users expect tray apps to appear instantly. Load minimal UI on first paint and lazy-load heavy data.

2) **Cache network calls**
   - Menu bar apps are often polled; keep API usage conservative with short-term caching and request coalescing.

3) **Graceful offline behavior**
   - If the network is unavailable, show cached data and the last update timestamp.

## Privacy & Security
1) **Store sensitive data locally and securely**
   - Local-only utilities should still encrypt API keys at rest where possible (keychain or OS-protected storage). Users trust menu bar apps to be invisible; that implies strong privacy defaults.

2) **Keep API keys off the renderer**
   - Electron best practice: store secrets in the main process or server, and expose limited data to the renderer.

## Testing & Quality
1) **Automated tests for data layers**
   - Test API client edge cases (no data, rate limits, partial failures) and leaderboard sorting.

2) **Manual checks on macOS behavior**
   - Test menu bar positioning, multi-display, system theme switching, and app lifecycle (quit/reopen).

---

## References
- Apple NSStatusBar documentation: https://developer.apple.com/documentation/appkit/nsstatusbar
- Apple Human Interface Guidelines (Menu Bar Extras, legacy archive): https://leopard-adc.pepas.com/documentation/UserExperience/Conceptual/AppleHIGuidelines/XHIGMenus/XHIGMenus.html
- Apple Support: “Show or hide menu bar items” (user control): https://support.apple.com/en-us/HT201276
- Electron Tray documentation: https://www.electronjs.org/docs/latest/api/tray
- Electron Tray tutorial: https://www.electronjs.org/docs/latest/tutorial/tray
