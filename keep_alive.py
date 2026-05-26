#!/usr/bin/env python3
import os
import sys
import requests
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timezone, timedelta

# IST = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def run_keep_alive():
    print("🚀 Starting Supabase Keep-Alive and Backup Job (SMTP)")
    
    supabase_url = os.environ.get('SUPABASE_URL', '').strip()
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()
    smtp_user = os.environ.get('SMTP_USER', '').strip() # e.g. save.shaving@gmail.com
    smtp_pass = os.environ.get('SMTP_PASSWORD', '').strip() # Gmail App Password
    recipient = os.environ.get('NOTIFICATION_EMAIL', 'save.shaving@gmail.com').strip()
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from environment.")
        sys.exit(1)
        
    print(f"Connecting to Supabase at: {supabase_url}")
    
    # 1. Ping Supabase by fetching a simple count or row to trigger keep-alive
    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json'
    }
    
    url = f"{supabase_url}/rest/v1/visits?select=*&order=timestamp.desc&limit=10000"
    
    try:
        print("📡 Pinging database visits table...")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        visits = resp.json()
        print(f"✅ Database ping successful. Retrieved {len(visits)} visitor logs.")
    except Exception as e:
        print(f"❌ Error pinging Supabase: {e}")
        if smtp_user and smtp_pass:
            send_failure_alert(smtp_user, smtp_pass, recipient, f"Database Ping Failure: {e}")
        sys.exit(1)
        
    # 2. Build CSV backup data
    csv_headers = ["id", "timestamp", "session_id", "theme", "device", "referrer", "repo_clicked", "duration_ms"]
    csv_rows = []
    
    for v in visits:
        row = [
            str(v.get('id', '')),
            str(v.get('timestamp', '')),
            str(v.get('session_id', '')),
            str(v.get('theme', '') or ''),
            str(v.get('device', '') or ''),
            str(v.get('referrer', '') or '').replace(',', ';'), 
            str(v.get('repo_clicked', '') or ''),
            str(v.get('duration_ms', 0))
        ]
        csv_rows.append(",".join(row))
        
    csv_content = "\n".join([",".join(csv_headers)] + csv_rows)
    
    # 3. Email the CSV backup via SMTP if configured
    if smtp_user and smtp_pass:
        send_email_backup_smtp(smtp_user, smtp_pass, recipient, csv_content, len(visits))
    else:
        print("⚠️ SMTP credentials not found (SMTP_USER / SMTP_PASSWORD). Skipping email backup.")
        print("💡 Tip: Configure SMTP_USER and SMTP_PASSWORD secrets in GitHub to receive backups in save.shaving@gmail.com.")

def send_email_backup_smtp(smtp_user, smtp_pass, recipient, csv_data, record_count):
    print(f"📧 Sending CSV backup email to: {recipient} ...")
    date_str = datetime.now(IST).strftime('%Y-%m-%d %H:%M IST')
    
    msg = MIMEMultipart()
    msg['From'] = f"Starred Repos Backup <{smtp_user}>"
    msg['To'] = recipient
    msg['Subject'] = f"📋 Starred Repos Analytics Backup - {date_str}"
    
    body = f"""
    <h3>Starred Repos Analytics Backup</h3>
    <p>Your automated 6-day backup of visitor analytics from Supabase has completed successfully.</p>
    <ul>
        <li><strong>Timestamp:</strong> {date_str}</li>
        <li><strong>Total Logged Visits:</strong> {record_count}</li>
        <li><strong>Database Status:</strong> Keep-Alive successful (Active)</li>
    </ul>
    <br>
    <p>The visits telemetry dataset has been attached as a compressed CSV file.</p>
    <hr>
    <p style="font-size: 0.85em; color: #666;">Generated automatically via GitHub Actions keep-alive SMTP runner.</p>
    """
    msg.attach(MIMEText(body, 'html'))
    
    attachment = MIMEBase('application', 'octet-stream')
    attachment.set_payload(csv_data.encode('utf-8'))
    encoders.encode_base64(attachment)
    attachment.add_header('Content-Disposition', f'attachment; filename="analytics_backup_{datetime.now(IST).strftime("%Y%m%d")}.csv"')
    msg.attach(attachment)
    
    try:
        print("🔌 Connecting to Gmail SMTP server...")
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [recipient], msg.as_string())
        server.quit()
        print("✅ Backup email sent successfully via Gmail SMTP.")
    except Exception as e:
        print(f"❌ Failed to send email via SMTP: {e}")

def send_failure_alert(smtp_user, smtp_pass, recipient, error_message):
    date_str = datetime.now(IST).strftime('%Y-%m-%d %H:%M IST')
    msg = MIMEMultipart()
    msg['From'] = f"Starred Repos Alert <{smtp_user}>"
    msg['To'] = recipient
    msg['Subject'] = f"⚠️ Starred Repos Keep-Alive Failure - {date_str}"
    
    body = f"""
    <h3>⚠️ Starred Repos Automation Failure</h3>
    <p>The scheduled keep-alive and backup run encountered an error and was unable to complete.</p>
    <p><strong>Error Message:</strong> {error_message}</p>
    <p><strong>Timestamp:</strong> {date_str}</p>
    <br>
    <p>Please check your GitHub Actions logs for details.</p>
    """
    msg.attach(MIMEText(body, 'html'))
    
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [recipient], msg.as_string())
        server.quit()
        print("✅ Failure alert email sent successfully.")
    except Exception as e:
        print(f"❌ Failed to send failure alert via SMTP: {e}")

if __name__ == "__main__":
    run_keep_alive()
