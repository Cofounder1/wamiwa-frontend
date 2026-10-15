#!/usr/bin/env python3
"""Puts the local backend into a realistic state for the demo accounts, using only the public API.

Run after `scripts/local-backend.sh seed` (or `reset`):

    python3 scripts/demo-scenario.py            # against http://localhost:8001
    WAMIWA_API=http://localhost:8001 python3 scripts/demo-scenario.py

Creates: Hire Me offers at several stages (offered, active, delivered, disputed), likeness contracts
(script review, and a final video awaiting approval), a minor's contract waiting for the guardian,
a delivered agent order, a Wamiwa Agent plan with links, a subscription and a support ticket.
Safe to re-run: each step reports and carries on if something already exists.
"""
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

API = os.environ.get("WAMIWA_API", "http://localhost:8001")
PASSWORD = "wamiwa-demo-2026"
CARD = "tok_visa"  # sandbox card token


def call(method, path, token=None, body=None):
    headers = {"content-type": "application/json", "idempotency-key": str(uuid.uuid4())}
    if token:
        headers["authorization"] = "Bearer " + token
    req = urllib.request.Request(API + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r).get("data")
    except urllib.error.HTTPError as e:
        detail = json.load(e)
        raise RuntimeError(f"{method} {path} → {e.code} {detail.get('code')}: {detail.get('error')} {detail.get('fields', '')}")


def login(email):
    return call("POST", "/auth/login", body={"email": email, "password": PASSWORD})["access_token"]


def step(label, fn):
    try:
        out = fn()
        print(f"  ✓ {label}")
        return out
    except RuntimeError as e:
        print(f"  · {label}: {e}")
        return None


def main():
    print(f"Wamiwa demo scenario → {API}")
    kemi, kiki, kola, zuri, zainab = (login(f"{h}@example.com") for h in ("kemi", "kiki", "kola", "zurihouse", "zainab"))
    me = lambda t: call("GET", "/accounts/me", t)  # noqa: E731
    kemi_id, kiki_id = me(kemi)["id"], me(kiki)["id"]
    soon = lambda d: (date.today() + timedelta(days=d)).isoformat()  # noqa: E731

    def offer(token, influencer, price, deliverables, posts, days, no_ai=False):
        return call("POST", "/hire-me/offers", token, {
            "influencer_id": influencer, "price_cents": price, "deliverables": deliverables, "deadline": soon(days),
            "num_posts": posts, "no_ai_replies": no_ai, "payment_method": CARD})

    print("Hire Me")
    o1 = step("Zuri sends Kemi an offer (left open in her inbox)", lambda: offer(
        zuri, kemi_id, 50000, "1 × 'first owambe outfit' story video\n1 × photo carousel", 2, 18))
    o2 = step("Zuri hires Kemi for the Harmattan launch (active)", lambda: offer(
        zuri, kemi_id, 80000, "1 × 60s routine video\n2 × story sets with swipe link\nUsage rights for 30 days", 3, 10, True))
    if o2:
        step("Kemi accepts and starts", lambda: (call("POST", f"/hire-me/contracts/{o2['id']}/accept", kemi),
                                                  call("POST", f"/hire-me/contracts/{o2['id']}/start", kemi)))
    o3 = step("Zuri hires Kemi for a taste test (delivered, in review)", lambda: offer(
        zuri, kemi_id, 40000, "1 × taste-test video", 1, 5))
    if o3:
        step("Kemi accepts, starts and delivers", lambda: (
            call("POST", f"/hire-me/contracts/{o3['id']}/accept", kemi), call("POST", f"/hire-me/contracts/{o3['id']}/start", kemi),
            call("POST", f"/hire-me/contracts/{o3['id']}/deliver", kemi, {"delivery": "Video posted: wamiwa.site/p/taste-test", "partial": False})))
    o4 = step("Zuri hires Kemi for a lookbook (delivered, then disputed)", lambda: offer(
        zuri, kemi_id, 60000, "1 × lookbook reel\n1 × carousel", 2, 4))
    if o4:
        step("Kemi delivers; Zuri opens a dispute", lambda: (
            call("POST", f"/hire-me/contracts/{o4['id']}/accept", kemi), call("POST", f"/hire-me/contracts/{o4['id']}/start", kemi),
            call("POST", f"/hire-me/contracts/{o4['id']}/deliver", kemi, {"delivery": "Reel + carousel posted", "partial": False}),
            call("POST", f"/contracts/{o4['id']}/dispute", zuri, {"reason": "Work doesn’t match the brief: carousel missing the new prints", "is_misuse_claim": False})))

    print("Minor (Kiki, 16) with guardian Kola")
    step("Kiki sets up her Hire Me page", lambda: call("PUT", "/hire-me/page", kiki, {"starting_price_cents": 12000, "photos": [], "videos": []}))
    step("Kola approves Zuri to message Kiki", lambda: call("PUT", f"/guardians/minors/{kiki_id}/companies/{me(zuri)['id']}", kola))
    o5 = step("Zuri sends Kiki a back-to-school offer", lambda: offer(
        zuri, kiki_id, 25000, "2 × illustrated posts featuring Zuri school bags", 2, 20))
    if o5:
        step("Kiki accepts (now waiting for Kola + confirmation call)", lambda: call("POST", f"/hire-me/contracts/{o5['id']}/accept", kiki))

    print("Hire My Likeness")
    script = ("[Scene: Lagos rooftop, golden hour]\n\nKEMI: Owambe season is here, and I’m not repeating outfits.\n\n"
              "KEMI: This is the Zuri “Owambe Season” collection — bold prints, soft fabrics, and cuts that let you dance.\n\n"
              "KEMI: Tap the link and find your look. Zuri Fashion House.")
    step("Zuri sends Kemi a likeness script (waiting for her review)", lambda: call("POST", "/likeness/contracts", zuri, {
        "influencer_id": kemi_id, "script": script, "with_voice": False, "exclusivity": False, "video_seconds": 30, "payment_method": CARD}))
    lk = step("Zuri sends a second script that Kemi signs", lambda: call("POST", "/likeness/contracts", zuri, {
        "influencer_id": kemi_id, "script": script.replace("Owambe Season", "Harmattan Glow"), "with_voice": False, "video_seconds": 30,
        "payment_method": CARD}))
    if lk:
        step("Kemi signs consent", lambda: call("POST", f"/likeness/contracts/{lk['id']}/accept", kemi,
                                                 {"consent_image": True, "consent_voice": False, "accept_responsibility": True}))
        step("Zuri renders a draft, then a final for approval", lambda: (
            call("POST", f"/likeness/contracts/{lk['id']}/videos", zuri, {"kind": "draft", "payment_method": CARD}),
            call("POST", f"/likeness/contracts/{lk['id']}/videos", zuri, {"kind": "final", "payment_method": CARD})))

    print("Agent order")
    orders = call("GET", "/agent-orders", zainab) or []
    if not orders:
        scribe = next(a for a in call("GET", "/marketplace/agents", kemi) if a["handle"] == "scribe")
        step("Kemi hires Scribe", lambda: call("POST", f"/marketplace/agents/{scribe['id']}/orders", kemi, {
            "payment_method": CARD, "task": "10 captions", "brief": "10 Instagram captions for my Ankara series, playful, a little Pidgin."}))
        orders = call("GET", "/agent-orders", zainab) or []
    for o in orders:
        if o["status"] == "active":
            step("Zainab delivers the Scribe order", lambda o=o: call("POST", f"/orders/{o['id']}/deliver", zainab, {
                "delivery": "1. Office to owambe in one skirt — which look are you choosing? 👀\n2. Ankara no dey carry last — this one get three lives.\n3. Same skirt, three moods. Comment your favourite number."}))

    print("Wamiwa Agent, subscription, support")
    step("Zuri buys the Business Plus plan with links", lambda: call("POST", "/promotions", zuri, {
        "kind": "business", "tier": "plus", "category": "fashion", "target_regions": ["nigeria", "ghana", "united_kingdom"],
        "payment_method": CARD, "links": [
            {"url": "https://zurihouse.example.com/shop", "label": "Shop", "keywords": ["buy", "shop", "where"]},
            {"url": "https://zurihouse.example.com/ankara", "label": "Ankara edit", "keywords": ["ankara", "skirt", "wrap"]},
            {"url": "https://bit.ly/zuri-sale", "label": "Sale", "keywords": ["sale", "discount"]}]}))
    step("Kemi subscribes (monthly)", lambda: call("POST", "/subscriptions", kemi, {"payment_method": CARD, "period": "monthly"}))
    step("Kemi opens a support ticket", lambda: call("POST", "/support/tickets", kemi, {
        "category": "payments", "subject": "When does my Harmattan launch money clear?", "body": "Delivered on time — just checking the payout date."}))
    print("Done.")


if __name__ == "__main__":
    main()
