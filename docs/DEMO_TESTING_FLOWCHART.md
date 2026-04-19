# InsightHub Demo Testing Flowchart

Use this flowchart to walk through every critical feature a demo user will encounter. Follow the **happy path** top-to-bottom, then branch into secondary flows.

## Mermaid Flowchart

```mermaid
flowchart TD
    %% ─── ENTRY ───────────────────────────────────────────────
    START([🌐 Open dashboards.jeffcoy.net]) --> LOGIN{Authenticated?}
    LOGIN -- No --> LOGIN_PAGE[Login Page loads]
    LOGIN_PAGE --> CREDS[Enter credentials / OAuth]
    CREDS --> ONBOARD_CHECK{First-time user?}
    LOGIN -- Yes --> ONBOARD_CHECK

    %% ─── ONBOARDING ──────────────────────────────────────────
    ONBOARD_CHECK -- Yes --> OB_WELCOME[Onboarding: Welcome Modal]
    OB_WELCOME --> OB_TEMPLATES[Onboarding: Template Gallery]
    OB_TEMPLATES --> OB_GUIDE[Onboarding: First Dashboard Guide]
    OB_GUIDE --> OB_COMPLETE[Complete Onboarding → redirects home]
    OB_COMPLETE --> HOME

    ONBOARD_CHECK -- No --> HOME

    %% ─── HOME PAGE ───────────────────────────────────────────
    HOME[🏠 Home Page loads]
    HOME --> HOME_CHECKS[✅ Verify: greeting, profile bubble,\ntheme toggle, nav links,\nkeyboard shortcut button]
    HOME_CHECKS --> CHOOSE_PATH{Choose demo path}

    %% ─── PATH A: AI PROMPT ───────────────────────────────────
    CHOOSE_PATH -- Type a prompt --> AI_PROMPT[Type natural-language prompt\nin hero textarea]
    AI_PROMPT --> AI_SUBMIT[Press Enter or click Send]
    AI_SUBMIT --> NEW_DASH[/dashboard/new — AI builds dashboard]

    CHOOSE_PATH -- Voice input --> VOICE[Click mic icon 🎙️\nor ⌘+Shift+M]
    VOICE --> VOICE_RESULT[Verify waveform + transcript appears]
    VOICE_RESULT --> AI_SUBMIT

    CHOOSE_PATH -- Quick Action card --> QUICK_ACTION[Click a template card\ne.g. Executive Summary]
    QUICK_ACTION --> NEW_DASH

    %% ─── PATH B: BROWSE SAVED ────────────────────────────────
    CHOOSE_PATH -- Browse saved --> GALLERY[/dashboards — Gallery page]

    %% ─── NEW DASHBOARD EDITOR ────────────────────────────────
    NEW_DASH --> EDITOR_CHECKS[✅ Verify:\n• Navbar renders\n• Chat panel with AI response\n• Canvas shows generated widgets\n• Version timeline visible]

    EDITOR_CHECKS --> CHAT_INTERACT[Chat Panel: send follow-up\ne.g. 'Add a pie chart for\nrevenue by region']
    CHAT_INTERACT --> WIDGETS_UPDATE[Verify widgets update on canvas]

    WIDGETS_UPDATE --> WIDGET_ACTIONS{Widget interactions}

    %% ─── WIDGET INTERACTIONS ─────────────────────────────────
    WIDGET_ACTIONS --> W_CLICK[Click widget → detail overlay]
    W_CLICK --> W_DETAIL[✅ WidgetDetailOverlay:\nfull data, metric explanation]
    W_DETAIL --> WIDGET_ACTIONS

    WIDGET_ACTIONS --> W_CONFIG[Click gear icon → WidgetConfigPanel]
    W_CONFIG --> W_CONFIG_TABS[✅ Test tabs:\nGeneral • Data • Visual\nChange type, color, aggregation]
    W_CONFIG_TABS --> WIDGET_ACTIONS

    WIDGET_ACTIONS --> W_RESIZE[Drag resize handles on widget]
    W_RESIZE --> WIDGET_ACTIONS

    WIDGET_ACTIONS --> W_MOVE[Drag-and-drop reorder widgets]
    W_MOVE --> WIDGET_ACTIONS

    WIDGET_ACTIONS --> W_CONTEXT[Right-click widget → context menu]
    W_CONTEXT --> W_CONTEXT_OPTS[✅ Duplicate, Delete, Configure,\nExport, Add to Dashboard]
    W_CONTEXT_OPTS --> WIDGET_ACTIONS

    WIDGET_ACTIONS --> W_QUERY[Open Widget Query Panel\n→ view generated SQL]
    W_QUERY --> W_PLAYGROUND[Open in Query Playground]
    W_PLAYGROUND --> PLAYGROUND_PAGE

    WIDGET_ACTIONS --> DONE_WIDGETS[Done testing widgets →]

    %% ─── WIDGET LIBRARY ──────────────────────────────────────
    DONE_WIDGETS --> LIB_OPEN[Open Widget Library panel]
    LIB_OPEN --> LIB_DRAG[Drag new widget type onto canvas\ne.g. Gauge, Pivot Table, Funnel]
    LIB_DRAG --> LIB_VERIFY[✅ Verify all 16 widget types render:\nKPI · Line · Bar · Stacked Bar · Area\nPie · Donut · Scatter · Heatmap\nTable · Pivot Table · Funnel\nGauge · Metric Row · Text Block · Divider]

    %% ─── SAVE & VERSION ──────────────────────────────────────
    LIB_VERIFY --> SAVE[Save dashboard ⌘+S]
    SAVE --> SAVE_VERIFY[✅ Verify: toast 'Dashboard saved'\n+ auto-save indicator\n+ thumbnail generation]
    SAVE_VERIFY --> VERSION[Check Version Timeline]
    VERSION --> VERSION_ACTIONS[✅ Test:\n• View version diff\n• Restore previous version\n• Bookmark a version]

    %% ─── SHARE ───────────────────────────────────────────────
    VERSION_ACTIONS --> SHARE[Open Share Modal]
    SHARE --> SHARE_CHECKS[✅ Test:\n• Copy link\n• Search & add users\n• Set permission: View / Comment / Edit\n• Toggle public link\n• Remove shared user]

    %% ─── SAVE AS / DUPLICATE ─────────────────────────────────
    SHARE_CHECKS --> SAVE_AS[Save As ⌘+Shift+S → creates copy]
    SAVE_AS --> SAVE_AS_VERIFY[✅ Redirects to new dashboard\nwith 'Saved as copy' toast]

    %% ─── NAVIGATE TO GALLERY ─────────────────────────────────
    SAVE_AS_VERIFY --> GALLERY
    GALLERY --> GALLERY_CHECKS[✅ Verify:\n• Grid/List view toggle\n• Search/filter dashboards\n• Sort: Recent, A-Z, etc.\n• Folder tree sidebar\n• Breadcrumbs navigation\n• Favorite star toggle\n• Recently viewed section]
    GALLERY_CHECKS --> GALLERY_FOLDERS[Test Folders:\n• Create folder\n• Move dashboard to folder\n• Rename / delete folder]
    GALLERY_FOLDERS --> GALLERY_OPEN[Click a saved dashboard]
    GALLERY_OPEN --> EXISTING_EDITOR[/dashboard/:id — Editor loads\nwith saved state]

    %% ─── EXISTING DASHBOARD EDITOR ───────────────────────────
    EXISTING_EDITOR --> ED_GLOSSARY[Toggle Glossary panel\nin editor sidebar]
    ED_GLOSSARY --> ED_GLOSSARY_CHECK[✅ Business terms + definitions\nappear contextually]

    %% ─── TEMPLATES PAGE ──────────────────────────────────────
    ED_GLOSSARY_CHECK --> TEMPLATES[Navigate to /templates]
    TEMPLATES --> TPL_CHECKS[✅ Verify:\n• 4+ template cards display\n• Category filter works\n• Search works\n• Grid/List toggle\n• Sort options]
    TPL_CHECKS --> TPL_OPEN[Click 'Use Template'\non a template card]
    TPL_OPEN --> TPL_EDITOR[New dashboard from template loads\nwith pre-built widgets]

    %% ─── GLOSSARY PAGE ──────────────────────────────────────
    TPL_EDITOR --> GLOSSARY_PAGE[Navigate to /glossary]
    GLOSSARY_PAGE --> GLOSSARY_CHECKS[✅ Verify:\n• Terms load with definitions\n• Search/filter works\n• Categories visible]

    %% ─── COMMAND PALETTE ─────────────────────────────────────
    GLOSSARY_CHECKS --> CMD_PALETTE[Open Command Palette ⌘+K]
    CMD_PALETTE --> CMD_CHECKS[✅ Verify:\n• Search across pages\n• Recent items shown\n• Navigate to any page\n• Toggle dark/light mode\n• Keyboard nav ↑↓ Enter]

    %% ─── KEYBOARD SHORTCUTS ──────────────────────────────────
    CMD_CHECKS --> SHORTCUTS[Press ? → Shortcut overlay]
    SHORTCUTS --> SHORTCUT_CHECKS[✅ Verify all shortcuts listed:\n⌘+K  Command palette\n⌘+S  Save\n⌘+⇧+S  Save As\n⌘+⇧+M  Voice input\n⌘+/  Focus chat\n?  Shortcut help]

    %% ─── THEME TOGGLE ────────────────────────────────────────
    SHORTCUT_CHECKS --> THEME[Toggle Light ↔ Dark mode]
    THEME --> THEME_CHECK[✅ All pages render correctly\nin both themes — no broken colors]

    %% ─── DATA TOOLS (if accessible) ─────────────────────────
    THEME_CHECK --> DATA_TOOLS{Data tools accessible?}

    DATA_TOOLS -- Yes --> EXPLORER[/data/explorer — Data Explorer]
    EXPLORER --> EXPLORER_CHECKS[✅ Verify:\n• Schema tree loads\n• Select table → preview data\n• Select column → profiler stats\n• Glossary panel toggle\n• SQL Editor copy button]

    EXPLORER_CHECKS --> VIS_QUERY[/data/visual-query\nVisual Query Builder]
    VIS_QUERY --> VIS_CHECKS[✅ Verify:\n• Table selection\n• Column picker\n• Filter conditions\n• Preview results\n• Save / share buttons]

    VIS_CHECKS --> PLAYGROUND_PAGE[/data/playground\nQuery Playground]
    PLAYGROUND_PAGE --> PG_CHECKS[✅ Verify:\n• New session creates\n• SQL editor cell works\n• Markdown cell works\n• Run query → results table\n• Multi-tab support\n• Session persistence localStorage]

    PG_CHECKS --> ABOUT_PAGE

    DATA_TOOLS -- No / Hidden --> ABOUT_PAGE

    %% ─── ABOUT PAGE ──────────────────────────────────────────
    ABOUT_PAGE[/about — About page] --> ABOUT_CHECK[✅ Page renders, no errors]

    %% ─── RESPONSIVE / MOBILE ─────────────────────────────────
    ABOUT_CHECK --> RESPONSIVE{Test responsive?}
    RESPONSIVE -- Yes --> MOBILE[Resize to mobile width]
    MOBILE --> MOBILE_CHECKS[✅ Verify:\n• MobileNotice appears\n• MobileTabBar navigation\n• Canvas/Chat toggle on phone\n• Tablet drawer layout\n• Touch targets ≥ 44px]
    MOBILE_CHECKS --> FINAL

    RESPONSIVE -- Skip --> FINAL

    %% ─── FINAL ───────────────────────────────────────────────
    FINAL([✅ Demo test complete!])

    %% ─── STYLING ─────────────────────────────────────────────
    classDef startEnd fill:#6baaff,stroke:#4a8ad4,color:#fff,font-weight:bold
    classDef check fill:#1a2332,stroke:#56c47a,color:#56c47a
    classDef page fill:#1a2332,stroke:#6baaff,color:#e8ecf2
    classDef decision fill:#2a1a3e,stroke:#b48eff,color:#e8ecf2
    classDef action fill:#1a2332,stroke:#dba644,color:#e8ecf2

    class START,FINAL startEnd
    class HOME_CHECKS,EDITOR_CHECKS,GALLERY_CHECKS,SAVE_VERIFY,SHARE_CHECKS,SAVE_AS_VERIFY,TPL_CHECKS,GLOSSARY_CHECKS,CMD_CHECKS,SHORTCUT_CHECKS,THEME_CHECK,EXPLORER_CHECKS,VIS_CHECKS,PG_CHECKS,ABOUT_CHECK,MOBILE_CHECKS,W_DETAIL,W_CONFIG_TABS,W_CONTEXT_OPTS,LIB_VERIFY,ED_GLOSSARY_CHECK,VOICE_RESULT check
    class HOME,NEW_DASH,GALLERY,EXISTING_EDITOR,TEMPLATES,GLOSSARY_PAGE,EXPLORER,VIS_QUERY,PLAYGROUND_PAGE,ABOUT_PAGE,LOGIN_PAGE,OB_WELCOME,OB_TEMPLATES,OB_GUIDE,TPL_EDITOR page
    class LOGIN,ONBOARD_CHECK,CHOOSE_PATH,WIDGET_ACTIONS,DATA_TOOLS,RESPONSIVE decision
    class AI_PROMPT,AI_SUBMIT,VOICE,QUICK_ACTION,CHAT_INTERACT,SAVE,VERSION,SHARE,SAVE_AS,LIB_OPEN,LIB_DRAG,GALLERY_FOLDERS,GALLERY_OPEN,TPL_OPEN,CMD_PALETTE,SHORTCUTS,THEME,MOBILE,ED_GLOSSARY,W_CLICK,W_CONFIG,W_RESIZE,W_MOVE,W_CONTEXT,W_QUERY,W_PLAYGROUND action
```

## Quick-Reference Checklist

| # | Feature | Route / Trigger | Status |
|---|---------|----------------|--------|
| 1 | **Login / Auth** | `/login` | ☐ |
| 2 | **Onboarding flow** | `/onboarding` (first-time users) | ☐ |
| 3 | **Home page** | `/` — greeting, prompt input, quick actions | ☐ |
| 4 | **Voice input** | Mic button or `⌘+Shift+M` | ☐ |
| 5 | **AI dashboard generation** | `/dashboard/new?prompt=...` | ☐ |
| 6 | **Chat panel follow-ups** | Chat panel in editor | ☐ |
| 7 | **Widget detail overlay** | Click any widget | ☐ |
| 8 | **Widget config panel** | Gear icon on widget | ☐ |
| 9 | **Widget resize & reorder** | Drag handles / drag-drop | ☐ |
| 10 | **Widget context menu** | Right-click widget | ☐ |
| 11 | **Widget query panel** | View SQL behind widget | ☐ |
| 12 | **Widget library** | Open library → drag new widgets | ☐ |
| 13 | **All 16 widget types render** | KPI, Line, Bar, etc. | ☐ |
| 14 | **Save (⌘+S)** | Toast + auto-save + thumbnail | ☐ |
| 15 | **Version timeline** | Diff, restore, bookmark | ☐ |
| 16 | **Share modal** | Copy link, add users, permissions | ☐ |
| 17 | **Save As (⌘+⇧+S)** | Duplicate dashboard | ☐ |
| 18 | **Dashboard gallery** | `/dashboards` — grid, list, search, sort, folders | ☐ |
| 19 | **Folder management** | Create, move, rename, delete folders | ☐ |
| 20 | **Favorites** | Star toggle on dashboard cards | ☐ |
| 21 | **Template gallery** | `/templates` — browse & use templates | ☐ |
| 22 | **Glossary page** | `/glossary` — terms & definitions | ☐ |
| 23 | **Glossary panel (in-editor)** | Toggle in dashboard editor | ☐ |
| 24 | **Command palette** | `⌘+K` — search, navigate, actions | ☐ |
| 25 | **Keyboard shortcuts overlay** | `?` key | ☐ |
| 26 | **Theme toggle** | Light ↔ Dark in both pages | ☐ |
| 27 | **Data Explorer** | `/data/explorer` (if accessible) | ☐ |
| 28 | **Visual Query Builder** | `/data/visual-query` (if accessible) | ☐ |
| 29 | **Query Playground** | `/data/playground` (if accessible) | ☐ |
| 30 | **About page** | `/about` | ☐ |
| 31 | **Responsive / Mobile** | Resize browser or use DevTools | ☐ |
| 32 | **Error boundaries** | Trigger error → graceful fallback | ☐ |
