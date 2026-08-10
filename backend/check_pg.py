import socket
s = socket.socket()
s.settimeout(3)
try:
    s.connect(("localhost", 5432))
    print("POSTGRES_OK")
except Exception as e:
    print(f"POSTGRES_FAIL: {e}")
finally:
    s.close()
