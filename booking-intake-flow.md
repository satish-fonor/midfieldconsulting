# Booking Intake Flow

## Goal

Design a lightweight post-booking intake flow that starts after a client books and pays through Calendly, then collects structured context before the consultation.

## Recommended Architecture

Use Calendly as the booking and payment layer, a small backend as the system of record, and a GPT-guided intake experience as the preparation layer.

Flow:

1. User books and pays in Calendly.
2. Calendly sends a webhook to the backend.
3. Backend verifies the webhook and identifies the booked event type.
4. Backend creates or upserts a `booking` record.
5. Backend creates an `intake_session` with a signed token.
6. Backend emails the client a tokenized intake URL.
7. Client opens the guided intake flow and submits answers.
8. GPT intake posts answers to the backend API.
9. Backend stores answers, generates a prep brief, and links it to the booking.
10. Consultation proceeds on Google Meet.
11. Recording status and meeting notes can be linked later if needed.

This keeps the public website static while moving all booking and intake state into a small backend later.

## Calendly Webhook Flow

Primary webhook:

- `POST /api/calendly/webhook`

Recommended webhook events to handle:

- `invitee.created`
- `invitee.canceled`
- optionally `routing_form_submission.created` if Calendly routing is used later

Webhook handling steps:

1. Verify Calendly webhook signature.
2. Parse the event payload.
3. Extract the Calendly event URI, invitee URI, event type URI, invitee email, invitee name, scheduled start time, and payment status if available.
4. Map the event type to the internal consultation type.
5. Upsert the booking by a stable external key.
6. If the booking is new, create an intake session and send the intake email.
7. If the webhook is a duplicate, return success without creating duplicate booking or intake rows.
8. If the booking is canceled, mark the booking and intake session accordingly.

## Event Type to Intake Flow Mapping

Calendly event types:

- `https://calendly.com/satish-midfieldconsulting/ai-prototype-review-30-minutes`
- `https://calendly.com/satish-midfieldconsulting/ai-system-deep-dive-60-minutes`

Suggested mapping:

- `ai-prototype-review-30-minutes`
  - internal booking type: `prototype_review_30`
  - shorter intake
  - narrower prep brief
  - focus on one workflow, one blocker, one decision

- `ai-system-deep-dive-60-minutes`
  - internal booking type: `system_deep_dive_60`
  - deeper intake
  - broader prep brief
  - cover system structure, integrations, risks, and decision points

## Suggested Backend Endpoints

- `POST /api/calendly/webhook`
  - receives Calendly webhook events

- `POST /api/intake/session`
  - creates an intake session manually if needed
  - useful for support or resend flows

- `GET /api/intake/session/{token}`
  - resolves a signed token to intake session metadata
  - returns booking summary, event type, questions, and session status

- `POST /api/intake/submit`
  - stores intake answers
  - triggers prep brief generation

- `GET /api/prep-brief/{booking_id}`
  - returns the generated prep brief for internal use

Recommended internal-only endpoints later if needed:

- `POST /api/intake/resend/{booking_id}`
- `POST /api/prep-brief/regenerate/{booking_id}`

## Suggested Email Flow

Recommended email sequence:

1. Calendly sends booking confirmation and payment confirmation.
2. Backend sends a follow-up intake email.

Intake email should include:

- consultation type
- booked date and time
- short explanation of why the intake matters
- signed intake URL
- reminder not to share passwords, private keys, or regulated personal data
- note that Google Meet sessions may be recorded

Possible subject lines:

- `Your Midfield consultation intake`
- `Please complete your consultation intake`

Optional reminder flow:

- reminder if intake is not completed 24 hours after booking
- reminder if intake is still incomplete 24 hours before the meeting

## Data Model

### booking

Purpose:

- one row per Calendly booking

Suggested fields:

- `id`
- `external_source` (`calendly`)
- `external_event_uri`
- `external_invitee_uri`
- `external_event_type_uri`
- `booking_type` (`prototype_review_30`, `system_deep_dive_60`)
- `status` (`booked`, `canceled`, `completed`)
- `payment_status`
- `invitee_name`
- `invitee_email`
- `scheduled_start_at`
- `scheduled_end_at`
- `google_meet_url` if available later
- `recording_status` nullable
- `created_at`
- `updated_at`

Indexes:

- unique on `external_invitee_uri`
- index on `invitee_email`
- index on `scheduled_start_at`

### intake_session

Purpose:

- one active intake link per booking, with token and expiration

Suggested fields:

- `id`
- `booking_id`
- `token_hash`
- `status` (`pending`, `submitted`, `expired`, `canceled`)
- `flow_type`
- `expires_at`
- `created_at`
- `submitted_at`

Indexes:

- unique on `booking_id` for active session
- index on `status`

### intake_response

Purpose:

- structured answers collected through GPT intake

Suggested fields:

- `id`
- `booking_id`
- `intake_session_id`
- `response_version`
- `answers_json`
- `summary_text`
- `submitted_by_email`
- `created_at`
- `updated_at`

Notes:

- keep the full answer object in JSON
- optionally store normalized fields later for search and reporting

### prep_brief

Purpose:

- internal preparation artifact for the consultation

Suggested fields:

- `id`
- `booking_id`
- `source_intake_response_id`
- `status` (`pending`, `ready`, `failed`)
- `brief_markdown`
- `brief_json`
- `generated_at`
- `updated_at`

## Secure Booking Identification

The intake must be tied to the correct booking without exposing raw internal IDs.

Recommended approach:

1. Store a normal internal `booking.id`.
2. Generate a random one-time intake token.
3. Store only a hash of the token in `intake_session.token_hash`.
4. Email the client a signed tokenized URL such as:

`https://midfieldconsulting.com/intake/{token}`

or

`https://app.midfieldconsulting.com/intake/{token}`

Recommended token properties:

- random, high-entropy opaque token
- one booking per active token
- expiration window
- invalidated or rotated after submit if needed

Why this approach:

- no raw booking IDs in public URLs
- simple lookup by token hash
- easy to revoke and reissue

## Idempotency Considerations

Calendly webhooks can arrive more than once.

Recommended handling:

- treat `external_invitee_uri` as the primary idempotency key for booking creation
- store webhook event IDs if Calendly provides them
- use database upserts rather than blind inserts
- if the intake session already exists for a booking, do not create another one
- if the intake response was already submitted, ignore duplicate submit attempts or version them explicitly

Also consider:

- cancellation webhooks arriving after intake creation
- reschedule flows that create a new invitee versus update the old one

## Supporting Two Intake Flows

Use one intake system with two flow definitions:

- `prototype_review_30`
- `system_deep_dive_60`

Recommended difference:

### prototype_review_30

Ask for:

- one sentence on what the tool is supposed to do
- one sentence on where it gets stuck
- one key system or data dependency
- one main decision the client wants help with

Prep brief output:

- short summary
- main blocker
- likely discussion path
- suggested first recommendations

### system_deep_dive_60

Ask for:

- workflow overview
- system components
- main data sources and integrations
- current failure modes
- team usage pattern
- goals for the consultation

Prep brief output:

- broader system summary
- risk areas
- candidate remediation paths
- discussion agenda for the full session

## Prep Brief Generation Idea

Once intake is submitted:

1. Validate required answers.
2. Normalize the response.
3. Pass the structured answers to an internal LLM prompt or rules-based formatter.
4. Generate:
   - short booking summary
   - workflow/system summary
   - main blockers
   - key questions to ask live
   - likely recommendations
5. Store the output in `prep_brief`.

Suggested consumers:

- founder before the call
- optional internal meeting notes workflow later

## Open Questions

- Does Calendly webhook payload include payment confirmation in the exact way needed, or does payment status need a separate check?
- Should intake emails be sent immediately after booking, or only after confirmed payment state?
- Should canceled bookings automatically expire intake sessions?
- Should rescheduled meetings reuse the same intake session or generate a new one?
- Should one client be able to reopen and edit intake answers after initial submit?
- Where should the GPT intake UI live later: separate app domain, lightweight embedded flow, or link to a dedicated intake frontend?
- Should recording status be manually updated later or integrated from Google Meet tooling?
- Should prep briefs be purely internal, or should clients receive a short confirmation summary too?

## Recommended First Implementation Order

1. Calendly webhook receiver
2. Booking persistence
3. Intake session creation with signed token URL
4. Intake email delivery
5. Intake submit endpoint
6. Prep brief generation
7. Optional recording and notes linkage later
