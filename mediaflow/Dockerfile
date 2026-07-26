# Deploy MediaFlow su Render (free) partendo dall'immagine ufficiale
FROM mhdzumair/mediaflow-proxy:latest

# Render passa PORT dinamicamente; l'immagine lo rispetta già.
ENV ENABLE_STREAMING_PROGRESS=false \
    DISABLE_SSL_VERIFICATION_GLOBALLY=true \
    FORWARDED_ALLOW_IPS=* \
    TRANSPORT_ROUTES={"all://":{"verify_ssl":false}} \
    GUNICORN_WORKERS=2 \
    GUNICORN_TIMEOUT=120
