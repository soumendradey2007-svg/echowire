I am designing a production-quality web application called EchoWire, a lightweight real-time voice-chat platform for gamers.

The existing screens provide the product structure and functionality, but the visual design must be redesigned substantially.

IMPORTANT:
Use the existing screens only as a reference for information architecture, required functionality, and screen coverage.

Do NOT preserve the existing visual style if it looks AI-generated.

I want a HUMAN-DESIGNED, PROFESSIONAL PRODUCT INTERFACE.

==================================================
PRODUCT
==================================================

EchoWire allows authenticated users to:

- create voice rooms
- join voice rooms
- leave voice rooms
- communicate using real-time voice
- mute/unmute themselves
- deafen themselves
- use push-to-talk
- see who is speaking
- see connection state
- create multiple rooms simultaneously
- invite friends
- add/remove friends
- block/unblock users
- kick users
- temporarily mute users
- manage room permissions
- transfer room ownership
- delete rooms
- use lightweight text chat
- save text chat history
- save room information
- listen to synchronized music with other people in the room
- manage profile and account settings
- manage audio devices
- manage privacy/security

The product is designed specifically for gaming, but the interface should NOT look like a stereotypical gaming UI.

==================================================
CORE VISUAL IDEA
==================================================

The product should feel like:

"A beautifully designed communication application that happens to be optimized for gamers."

It should NOT feel like:

"A gaming dashboard that happens to contain voice chat."

The product should feel mature enough that a professional designer could confidently put it in a portfolio.

==================================================
ABSOLUTELY REMOVE
==================================================

Do NOT use:

- neon purple
- neon green
- neon cyan
- glowing borders
- glowing buttons
- glowing cards
- gradient text
- cyberpunk styling
- futuristic HUD elements
- military/tactical styling
- sci-fi decorations
- animated backgrounds
- particle effects
- excessive gradients
- glassmorphism
- excessive blur
- giant floating cards
- excessive pill-shaped UI
- decorative statistics
- fake technical metrics
- unnecessary badges
- excessive uppercase labels
- excessive iconography
- cards inside cards inside cards

NO NEON.
NO GLOW.
NO CYBERPUNK.

==================================================
VISUAL REFERENCES — PHILOSOPHY ONLY
==================================================

Use the following products only as references for design restraint, hierarchy, and usability:

- Linear
- Raycast
- Slack
- Discord
- modern developer tools
- premium desktop applications

DO NOT copy their branding, layouts, assets, or exact components.

Borrow only principles such as:
- clear information hierarchy
- excellent spacing
- restrained color
- purposeful interaction states
- compact navigation
- strong typography
- professional density

==================================================
COLOR SYSTEM
==================================================

Create a neutral, sophisticated palette.

Primary foundation:
- charcoal / near-black

Secondary surfaces:
- subtle variations of dark gray

Borders:
- very subtle and low contrast

Primary text:
- off-white

Secondary text:
- muted gray

Tertiary text:
- darker muted gray

Accent:
Choose ONE restrained accent color.

The accent must be used sparingly.

Use it primarily for:
- selected navigation
- primary actions
- active states
- speaking state
- important confirmations

Do NOT color every component with the accent.

Semantic colors:
- success
- warning
- error
- connection issue

These should remain subtle and functional.

==================================================
TYPOGRAPHY
==================================================

Typography should create the hierarchy.

Use one modern, highly readable sans-serif family.

Establish a clear type scale for:

- page titles
- section titles
- room names
- usernames
- body text
- secondary information
- timestamps
- controls

Avoid excessive font weights.

Avoid tiny unreadable metadata.

Avoid excessive all-caps text.

==================================================
SPACING
==================================================

Use intentional whitespace.

Increase breathing room compared with the existing designs.

Do not solve every layout problem using another border or card.

Use:

- alignment
- grouping
- spacing
- subtle dividers

to establish structure.

==================================================
COMPONENT PHILOSOPHY
==================================================

Every component must have a purpose.

Create reusable components for:

- buttons
- icon buttons
- inputs
- selects
- toggles
- tabs
- navigation items
- avatars
- badges
- tooltips
- dropdown menus
- context menus
- dialogs
- toasts
- skeleton loaders
- empty states
- error states
- participant rows
- room rows
- chat messages
- music controls
- voice controls

Use consistent geometry.

Avoid making every component look like a rounded card.

==================================================
APP SHELL
==================================================

Create a compact desktop application shell.

Desktop layout:

LEFT:
Primary navigation.

CENTER:
Main product experience.

OPTIONAL RIGHT:
Contextual information such as:
- room members
- chat
- music
- room details

The right side should be collapsible.

Do not permanently consume valuable screen space.

==================================================
VOICE ROOM
==================================================

This is the most important screen.

The voice room should feel social and calm.

Primary information hierarchy:

1. Current room
2. Participants
3. Who is speaking
4. Chat
5. Voice controls
6. Music

Participants should be presented simply.

Show:
- avatar
- username
- speaking state
- muted state when needed
- moderator/owner indicator when relevant

Do NOT display unnecessary technical metrics next to each person.

Speaking state should be subtle.

Use something like:
- restrained outline
- slight background change
- simple activity indicator

NOT a neon glow.

==================================================
VOICE CONTROL BAR
==================================================

Create a compact persistent bottom control area.

Primary:
- Mute
- Deafen
- Push-to-talk
- Disconnect

Secondary:
- Audio/device settings

Use clear icons and labels where necessary.

Do not make controls oversized.

Disconnect must have a clearly destructive visual treatment.

==================================================
CHAT
==================================================

Chat should feel like a real conversation.

Use:

Avatar
Username
Timestamp
Message

Do NOT place every message into a large card.

Use spacing and alignment.

Support:
- message hover actions
- mentions
- timestamps
- unread indicator
- empty state
- error state

Keep it lightweight.

==================================================
MUSIC
==================================================

Music should feel integrated into the communication experience.

Create a compact music player with:

- artwork
- title
- artist
- play/pause
- progress
- queue
- synchronization state

Make the concept "Listening together" clear.

Do not make it look like a DJ console.

Do not use music visualizers.

==================================================
ROOM BROWSER
==================================================

Room discovery should be extremely scannable.

Show only useful information:

- room name
- privacy/access state
- participant count
- relevant activity

Avoid unnecessary technical information.

==================================================
ROOM CREATION
==================================================

Create a clean modal or page for:

- room name
- description
- visibility
- optional password
- maximum members
- permissions
- text chat toggle
- music permissions

Keep the form compact.

==================================================
MODERATION
==================================================

Do not expose every moderation function permanently.

Use contextual controls:

- context menu
- member menu
- confirmation dialog

Actions:
- mute
- kick
- block
- unblock
- change permissions
- transfer ownership
- delete room

Destructive actions must be visually distinct.

==================================================
FRIENDS
==================================================

Design a simple friends experience.

States:

- online
- offline
- pending
- blocked

Actions:

- add friend
- accept
- reject
- remove
- block
- unblock

Do not overdesign this screen.

==================================================
AUTH
==================================================

Create:

- landing
- sign in
- sign up
- email verification
- forgot password
- reset password

Keep authentication visually minimal.

No giant gaming artwork.

No excessive decoration.

==================================================
SETTINGS
==================================================

Settings should feel like mature desktop software.

Sections:

ACCOUNT
VOICE & AUDIO
NOTIFICATIONS
PRIVACY & SECURITY
APPEARANCE

Use:
- clear headings
- descriptions
- controls
- subtle separators

Do not put every individual setting in its own large card.

==================================================
SECURITY
==================================================

Design:

- active sessions
- logout other sessions
- password change
- email verification
- blocked users
- account deletion
- privacy controls

The security experience should feel trustworthy and calm.

==================================================
EMPTY / ERROR / LOADING STATES
==================================================

Design complete states for:

- no friends
- no rooms
- empty voice room
- empty chat
- empty music queue
- no active sessions
- no blocked users
- room full
- private room
- kicked
- blocked
- room deleted
- invalid invite
- expired invite
- microphone permission denied
- microphone unavailable
- connection lost
- reconnecting
- music unavailable
- server unavailable
- unauthorized action
- rate limited
- 404

These states should use the same design system.

==================================================
RESPONSIVE
==================================================

Design proper layouts for:

390px
430px
768px
1024px
1280px
1440px

Do NOT merely scale the desktop layout.

Mobile should have:

- collapsible navigation
- mobile room view
- bottom voice controls
- chat drawer
- member drawer
- music drawer

Fix all possible:
- overflow
- clipped text
- modal overflow
- long names
- long room names
- inaccessible controls

==================================================
ACCESSIBILITY
==================================================

Design with:

- visible focus states
- accessible labels
- sufficient contrast
- keyboard navigation
- sensible touch targets
- clear state changes
- tooltips for unfamiliar controls

==================================================
PERFORMANCE
==================================================

This is a lightweight application.

The UI should avoid:

- decorative animation
- animated backgrounds
- particle effects
- heavy blur
- video
- 3D
- unnecessary gradients
- expensive shadows

Premium appearance must come from:

TYPOGRAPHY
SPACING
ALIGNMENT
HIERARCHY
CONSISTENCY

not visual effects.

==================================================
DESIGN SYSTEM DELIVERABLE
==================================================

Create a reusable design system containing:

- color variables
- typography variables
- spacing scale
- radii
- borders
- elevation/shadows
- interaction states
- buttons
- form elements
- navigation
- avatar sizes
- badges
- dialogs
- menus
- notifications
- voice controls

Use variables/tokens wherever possible.

All screens should consume the SAME design system.

==================================================
FINAL AI-SLOP AUDIT
==================================================

Before finalizing, inspect every screen.

Remove anything that looks like it was generated simply because the prompt contained the words:

"gaming"
"AI"
"futuristic"
"voice chat"

Specifically remove:

- unnecessary glow
- excessive gradients
- repetitive cards
- meaningless technical information
- decorative badges
- fake statistics
- redundant labels
- excessive icons
- excessive rounded containers
- unnecessary borders
- excessive visual effects

Every element must answer:

"Why is this here?"

If there is no strong answer, remove it.

FINAL RESULT:

Minimal.
Professional.
Calm.
Distinctive.
Fast.
Human-designed.
Gaming-focused through functionality rather than decoration.