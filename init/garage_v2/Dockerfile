FROM dxflrs/garage:v1.1.0

# Másoljuk be a statikus konfigurációs fájlt a képfájlba
# Így a Docker futtatásakor már garantáltan létezik, és nem kell a host-ról csatolni (nincs "Is a directory" hiba)
COPY garage.toml /etc/garage/garage.toml

# Felülírjuk az alapértelmezett parancsot, hogy ezt a beépített fájlt használja
CMD ["/garage", "-c", "/etc/garage/garage.toml", "server"]
