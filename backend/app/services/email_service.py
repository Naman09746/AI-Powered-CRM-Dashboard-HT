import html
import json
import os
import smtplib
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict


def build_email_preview(result: Any) -> Dict[str, Any]:
    prospect = result.prospect
    body = result.email_body or ""
    sign_off = result.sign_off or "Regards,\nDharmendra Sharma\nHamari Technology"
    if sign_off and sign_off not in body:
        body = f"{body.rstrip()}\n\n{sign_off}"

    return {
        "result_id": result.id,
        "prospect_id": prospect.id,
        "to_email": prospect.email,
        "company_name": prospect.company_name,
        "subject": result.subject_line or f"Digital growth support for {prospect.company_name}",
        "body": body,
        "lead_score": result.lead_score,
        "send_best_day": result.send_best_day,
        "send_best_time": result.send_best_time,
        "channel_primary": result.channel_primary,
        "follow_ups": result.follow_ups,
    }


def _html_body(preview: Dict[str, Any]) -> str:
    paragraphs = [
        f"<p>{html.escape(block).replace(chr(10), '<br>')}</p>"
        for block in preview["body"].split("\n\n")
        if block.strip()
    ]
    return f"""<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
    {''.join(paragraphs)}
  </body>
</html>"""


def _send_gmail(preview: Dict[str, Any]) -> str:
    gmail_address = os.getenv("GMAIL_ADDRESS")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD")
    sender_name = os.getenv("GMAIL_SENDER_NAME", "Hamari Technology")
    if not gmail_address or not gmail_password:
        raise RuntimeError("Gmail credentials are not configured")
    if not preview.get("to_email"):
        raise RuntimeError("Prospect email is missing")

    message = MIMEMultipart("alternative")
    message["Subject"] = preview["subject"]
    message["From"] = f"{sender_name} <{gmail_address}>"
    message["To"] = preview["to_email"]
    message.attach(MIMEText(preview["body"], "plain", "utf-8"))
    message.attach(MIMEText(_html_body(preview), "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_address, gmail_password)
        server.send_message(message)
    return "gmail"


def _send_brevo(preview: Dict[str, Any]) -> str:
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("BREVO_SENDER_EMAIL") or os.getenv("GMAIL_ADDRESS")
    sender_name = os.getenv("BREVO_SENDER_NAME", os.getenv("GMAIL_SENDER_NAME", "Hamari Technology"))
    if not api_key:
        raise RuntimeError("Brevo API key is not configured")
    if not sender_email:
        raise RuntimeError("Brevo sender email is not configured")
    if not preview.get("to_email"):
        raise RuntimeError("Prospect email is missing")

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": preview["to_email"], "name": preview["company_name"]}],
        "subject": preview["subject"],
        "htmlContent": _html_body(preview),
        "textContent": preview["body"],
    }
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status >= 400:
                raise RuntimeError(f"Brevo rejected email with status {response.status}")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Brevo rejected email with status {exc.code}") from exc
    return "brevo"


def send_email(preview: Dict[str, Any], dry_run: bool = True) -> Dict[str, str]:
    if dry_run:
        return {"status": "dry_run", "provider": "dry_run"}

    if os.getenv("BREVO_API_KEY"):
        provider = _send_brevo(preview)
        return {"status": "sent", "provider": provider}

    provider = _send_gmail(preview)
    return {"status": "sent", "provider": provider}
