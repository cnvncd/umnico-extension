# Umnico Extension Backend - Deployment Summary

## ✅ Deployment Complete

**Server:** 5.42.124.161  
**Date:** 2026-05-14  
**Status:** Running

---

## 🌐 Access URLs

- **API Base URL:** `http://5.42.124.161/api`
- **Admin Panel:** `http://5.42.124.161/admin`
- **Health Check:** `http://5.42.124.161/health`

---

## 📦 Deployed Components

### Backend API (Port 3001 → 80 via Nginx)
- ✅ Express server running
- ✅ PostgreSQL database initialized
- ✅ All tables created (integrations, leads, postbacks, referral_links)
- ✅ Docker containers running
- ✅ Nginx reverse proxy configured

### Admin Panel
- ✅ Web interface accessible at `/admin`
- ✅ Manage integrations (add/delete)
- ✅ Manage referral links (add/edit/delete)

### Browser Extension
- ✅ Updated to use new API endpoint
- ✅ File: `ext_v6/background.js` updated with `http://5.42.124.161/api`

---

## 🔧 Configuration

### Docker Containers
```bash
# View status
docker compose -f /opt/umnico-backend/docker-compose.yml ps

# View logs
docker compose -f /opt/umnico-backend/docker-compose.yml logs -f app
docker compose -f /opt/umnico-backend/docker-compose.yml logs -f db

# Restart
docker compose -f /opt/umnico-backend/docker-compose.yml restart
```

### Database Credentials
- **User:** umnico_user
- **Password:** UmnicoSecure2026!Pass
- **Database:** umnico_db
- **Port:** 5432 (internal)

### Environment Variables
Located at: `/opt/umnico-backend/.env`
```
PORT=3001
NODE_ENV=production
POSTGRES_USER=umnico_user
POSTGRES_PASSWORD=UmnicoSecure2026!Pass
POSTGRES_DB=umnico_db
ALLOWED_ORIGINS=http://5.42.124.161,https://5.42.124.161,chrome-extension://
```

---

## 📋 API Endpoints

### For Browser Extension
- `GET /api/browser-extension/:leadId` - Get lead data, postbacks, and referral links
- `GET /api/postback` - Receive postbacks from Keitaro
- `POST /api/leads` - Create or update lead

### For Admin Panel
- `GET /api/admin/integrations` - List integrations
- `POST /api/admin/integrations` - Create integration
- `DELETE /api/admin/integrations/:id` - Delete integration
- `GET /api/admin/integrations/:id/links` - Get links for integration
- `POST /api/admin/integrations/:id/links` - Add link
- `PUT /api/admin/links/:id` - Update link
- `DELETE /api/admin/links/:id` - Delete link

### System
- `GET /health` - Health check

---

## 🚀 Next Steps

### 1. Setup Integrations in Admin Panel
1. Open `http://5.42.124.161/admin`
2. Click "Добавить интеграцию"
3. Add your integrations with `sa_id` from Umnico
4. Add referral links for each integration

### 2. Install Browser Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `ext_v6` folder
5. Extension is ready to use on Umnico pages

### 3. Configure Keitaro Postback
Add this postback URL in Keitaro:
```
http://5.42.124.161/api/postback?external_id={external_id}&status={status}&offer={offer_name}&sub_id={sub_id_5}&payout={payout}
```

### 4. Create Leads via API
```bash
curl -X POST http://5.42.124.161/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "umnico_id": "lead_123",
    "telegram_fullname": "John Doe",
    "sa_id": "108954"
  }'
```

---

## 🔒 Security Recommendations

1. **Setup SSL Certificate** (Optional but recommended)
   ```bash
   apt install certbot python3-certbot-nginx
   # Get a domain name first, then:
   certbot --nginx -d your-domain.com
   ```

2. **Setup Firewall**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **Add Basic Auth to Admin Panel** (Optional)
   Edit `/etc/nginx/sites-available/umnico-backend`:
   ```nginx
   location /admin {
       auth_basic "Admin Area";
       auth_basic_user_file /etc/nginx/.htpasswd;
       proxy_pass http://localhost:3001;
   }
   ```

4. **Regular Backups**
   ```bash
   # Backup database
   docker compose -f /opt/umnico-backend/docker-compose.yml exec db \
     pg_dump -U umnico_user umnico_db > backup_$(date +%Y%m%d).sql
   ```

---

## 🐛 Troubleshooting

### Check if services are running
```bash
docker compose -f /opt/umnico-backend/docker-compose.yml ps
systemctl status nginx
```

### View logs
```bash
# Application logs
docker compose -f /opt/umnico-backend/docker-compose.yml logs -f app

# Database logs
docker compose -f /opt/umnico-backend/docker-compose.yml logs -f db

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Restart services
```bash
# Restart Docker containers
docker compose -f /opt/umnico-backend/docker-compose.yml restart

# Restart Nginx
systemctl restart nginx
```

### Database connection issues
```bash
# Connect to database
docker compose -f /opt/umnico-backend/docker-compose.yml exec db \
  psql -U umnico_user -d umnico_db

# Check tables
\dt

# Check data
SELECT * FROM integrations;
SELECT * FROM leads LIMIT 10;
```

---

## 📞 Support

For issues or questions:
- Check logs first
- Review README.md in `/opt/umnico-backend/`
- Verify all containers are running
- Test health endpoint: `curl http://5.42.124.161/health`

---

**Deployment completed successfully! 🎉**
