import os
import smtplib
from dotenv import load_dotenv

load_dotenv(override=True)

user = os.getenv("SMTP_USERNAME", "")
pw = os.getenv("SMTP_PASSWORD", "")
print("username:", user)
print("password length:", len(pw), "| letters only:", pw.isalpha())

s = None
try:
    s = smtplib.SMTP(os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587")), timeout=20)
    s.ehlo()
    s.starttls()
    s.ehlo()
    s.login(user, pw)
    print("LOGIN OK")
except smtplib.SMTPAuthenticationError as e:
    print("GMAIL SAID:", e.smtp_code, e.smtp_error.decode(errors="replace"))
except smtplib.SMTPServerDisconnected as e:
    print("DISCONNECTED:", e)
except Exception as e:
    print("OTHER ERROR:", type(e).__name__, e)
finally:
    if s is not None:
        try:
            s.quit()
        except Exception:
            pass