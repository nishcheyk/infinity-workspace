"""Email service for sending transactional emails."""
import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Send an email using SMTP or log to console/file in development.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        text_content: Plain text content (optional)

    Returns:
        True if email sent successfully, False otherwise
    """
    # Check if SMTP is configured
    smtp_configured = settings.SMTP_USER and settings.SMTP_PASSWORD

    if not smtp_configured:
        # Development mode: Log to console and file
        logger.warning("⚠️  SMTP not configured - Email logged to console and file")
        logger.info(
            f"""
╔══════════════════════════════════════════════════════════════
║ 📧 EMAIL (Development Mode)
╠══════════════════════════════════════════════════════════════
║ To: {to_email}
║ Subject: {subject}
╠══════════════════════════════════════════════════════════════
║ {text_content if text_content else 'See HTML content below'}
╚══════════════════════════════════════════════════════════════
        """
        )

        # Save to file for easy access
        try:
            emails_dir = "dev_emails"
            os.makedirs(emails_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{emails_dir}/email_{timestamp}_{to_email.replace('@', '_at_')}.html"

            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"<!-- To: {to_email} -->\n")
                f.write(f"<!-- Subject: {subject} -->\n")
                f.write(f"<!-- Time: {datetime.now().isoformat()} -->\n\n")
                f.write(html_content)

            logger.info(f"✅ Email saved to: {filename}")
        except Exception as e:
            logger.error(f"Failed to save email to file: {e}")

        return True

    try:
        # Production mode: Send via SMTP
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email

        if text_content:
            part1 = MIMEText(text_content, "plain")
            msg.attach(part1)

        part2 = MIMEText(html_content, "html")
        msg.attach(part2)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"✅ Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False


def send_password_reset_email(email: str, reset_token: str) -> bool:
    """
    Send password reset email with reset link.

    Args:
        email: User's email address
        reset_token: Password reset token

    Returns:
        True if email sent successfully
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .button {{ display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>We received a request to reset your password for your Infinity Intelligence Platform account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="{reset_url}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea;">{reset_url}</p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this password reset, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© 2026 Infinity Intelligence Platform. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Password Reset Request

    We received a request to reset your password for your Infinity Intelligence Platform account.

    Click this link to reset your password:
    {reset_url}

    This link will expire in 1 hour.

    If you didn't request this password reset, please ignore this email.
    """

    return send_email(email, "Reset Your Password", html_content, text_content)


def send_verification_email(email: str, verification_token: str) -> bool:
    """
    Send email verification email.

    Args:
        email: User's email address
        verification_token: Email verification token

    Returns:
        True if email sent successfully
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .button {{ display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✨ Welcome to Infinity Intelligence!</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>Thank you for creating an account with Infinity Intelligence Platform!</p>
                <p>Please verify your email address by clicking the button below:</p>
                <a href="{verification_url}" class="button">Verify Email</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea;">{verification_url}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>Once verified, you'll have full access to all platform features.</p>
            </div>
            <div class="footer">
                <p>© 2026 Infinity Intelligence Platform. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Welcome to Infinity Intelligence!

    Thank you for creating an account with Infinity Intelligence Platform!

    Please verify your email address by clicking this link:
    {verification_url}

    This link will expire in 24 hours.

    Once verified, you'll have full access to all platform features.
    """

    return send_email(email, "Verify Your Email", html_content, text_content)
