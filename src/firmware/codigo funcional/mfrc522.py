"""Controlador mínimo MFRC522 por SPI para identificar una tarjeta ISO14443A.

Implementación local basada en registros del datasheet de NXP MFRC522 Rev. 3.9:
https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf
No lee ni escribe bloques de dinero; solo devuelve el UID de 4, 7 o 10 bytes.
"""
from machine import Pin, SPI
from time import sleep_ms, ticks_ms, ticks_diff


class MFRC522:
    OK = 0
    NOTAGERR = 1
    ERR = 2
    REQIDL = 0x26
    REQALL = 0x52
    PICC_ANTICOLL1 = 0x93
    PICC_ANTICOLL2 = 0x95
    PICC_ANTICOLL3 = 0x97

    def __init__(self, sck=2, mosi=3, miso=4, rst=5, cs=1, spi_id=0):
        self.cs = Pin(cs, Pin.OUT, value=1)
        self.rst = Pin(rst, Pin.OUT, value=0)
        self.spi = SPI(spi_id, baudrate=1000000, polarity=0, phase=0,
                       sck=Pin(sck), mosi=Pin(mosi), miso=Pin(miso))
        sleep_ms(2)
        self.rst.value(1)
        sleep_ms(50)
        self._write(0x01, 0x0F)  # SoftReset.
        sleep_ms(50)
        if self._read(0x37) in (0x00, 0xFF):
            raise OSError("RC522 no responde: revisar alimentación 3.3 V y SPI")
        self._write(0x2A, 0x80)  # Timer automático al terminar la transmisión.
        self._write(0x2B, 0xA9)  # 13.56 MHz / (2 * 169 + 1) = 40 kHz.
        self._write(0x2C, 0x03)  # Reload 1000: espera de aproximadamente 25 ms.
        self._write(0x2D, 0xE8)
        self._write(0x12, 0x00)  # ISO14443A, 106 kbit/s, CRC manual.
        self._write(0x13, 0x00)
        self._write(0x15, 0x40)  # Modulación ASK del 100 %.
        self._write(0x11, 0x3D)  # CRC-A.
        self._write(0x14, self._read(0x14) | 0x03)  # Antena encendida.

    def _write(self, register, value):
        self.cs.value(0)
        try:
            self.spi.write(bytes(((register << 1) & 0x7E, value)))
        finally:
            self.cs.value(1)

    def _read(self, register):
        self.cs.value(0)
        try:
            self.spi.write(bytes((((register << 1) & 0x7E) | 0x80,)))
            return self.spi.read(1)[0]
        finally:
            self.cs.value(1)

    @staticmethod
    def crc_a(data):
        crc = 0x6363
        for value in data:
            value ^= crc & 0xFF
            value ^= (value << 4) & 0xFF
            crc = ((crc >> 8) ^ (value << 8) ^ (value << 3) ^ (value >> 4)) & 0xFFFF
        return [crc & 0xFF, (crc >> 8) & 0xFF]

    def _transceive(self, data, last_bits=0):
        self._write(0x01, 0x00)  # Idle.
        self._write(0x04, 0x7F)  # Limpiar interrupciones.
        self._write(0x0A, 0x80)  # Vaciar FIFO.
        for value in data:
            self._write(0x09, value)
        self._write(0x0D, last_bits)
        self._write(0x01, 0x0C)  # Transceive.
        self._write(0x0D, last_bits | 0x80)  # StartSend.
        started = ticks_ms()
        status = self.ERR
        while ticks_diff(ticks_ms(), started) < 60:
            irq = self._read(0x04)
            if irq & 0x30:  # RxIRq o IdleIRq.
                status = self.OK
                break
            if irq & 0x01:  # TimerIRq: tarjeta ausente.
                status = self.NOTAGERR
                break
        self._write(0x0D, last_bits)
        if status != self.OK:
            return status, [], 0
        # Buffer overflow, collision, CRC, parity o protocol error.
        if self._read(0x06) & 0x1F:
            return self.ERR, [], 0
        count = self._read(0x0A)
        if count == 0 or count > 64:
            return self.ERR, [], 0
        valid_bits = self._read(0x0C) & 0x07
        bits = (count - 1) * 8 + valid_bits if valid_bits else count * 8
        return self.OK, [self._read(0x09) for _ in range(count)], bits

    def request(self, mode):
        status, response, bits = self._transceive([mode], 7)
        if status == self.OK and bits != 16:
            return self.ERR, 0
        return status, (response[0] | (response[1] << 8)) if len(response) == 2 else 0

    def anticoll(self, cascade=PICC_ANTICOLL1):
        self._write(0x0E, self._read(0x0E) & ~0x80)
        status, response, bits = self._transceive([cascade, 0x20])
        if status != self.OK or bits != 40 or len(response) != 5:
            return self.ERR, []
        if response[0] ^ response[1] ^ response[2] ^ response[3] != response[4]:
            return self.ERR, []
        return self.OK, response

    def _select(self, cascade, uid_with_bcc):
        frame = [cascade, 0x70] + uid_with_bcc
        status, response, bits = self._transceive(frame + self.crc_a(frame))
        if status != self.OK or bits != 24 or len(response) != 3:
            return self.ERR, 0
        if self.crc_a(response[:1]) != response[1:]:
            return self.ERR, 0
        return self.OK, response[0]

    def read_uid(self):
        status, _ = self.request(self.REQALL)
        if status != self.OK:
            return None
        uid = []
        for cascade in (self.PICC_ANTICOLL1, self.PICC_ANTICOLL2, self.PICC_ANTICOLL3):
            status, part = self.anticoll(cascade)
            if status != self.OK:
                return None
            status, sak = self._select(cascade, part)
            if status != self.OK:
                return None
            continued = bool(sak & 0x04)
            if continued:
                if part[0] != 0x88 or cascade == self.PICC_ANTICOLL3:
                    return None
                uid.extend(part[1:4])  # Excluir Cascade Tag y BCC.
            else:
                uid.extend(part[:4])  # Excluir BCC.
                frame = [0x50, 0x00]  # HALT: la ausencia de respuesta es normal.
                self._transceive(frame + self.crc_a(frame))
                return uid
        return None
