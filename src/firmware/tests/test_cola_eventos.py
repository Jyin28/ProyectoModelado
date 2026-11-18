"""Cola de eventos del colchon (logica pura, sin red)."""
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "common", "communication"))

import cola_eventos as ce  # noqa: E402


def nuevo_id():
    nuevo_id.n += 1
    return "id-%d" % nuevo_id.n


nuevo_id.n = 0


class ColaTests(unittest.TestCase):
    def setUp(self):
        self.cola = ce.ColaEventos(nuevo_id)

    def test_entrega_en_orden_y_con_la_edad_en_segundos(self):
        self.cola.agregar("colchon_armado", {"a": 1}, 1000)
        self.cola.agregar("alarma_colchon", {"b": 2}, 4000)
        lista = self.cola.pendientes(6500)
        self.assertEqual([(e["tipo"], edad) for e, edad in lista],
                         [("colchon_armado", 5), ("alarma_colchon", 2)])

    def test_cada_evento_tiene_un_event_id_propio_y_estable(self):
        self.cola.agregar("a", {}, 0)
        self.cola.agregar("b", {}, 0)
        primero, segundo = [e for e, _ in self.cola.pendientes(10)]
        self.assertNotEqual(primero["event_id"], segundo["event_id"])
        self.cola.reintentar(primero, 10)
        self.assertEqual(self.cola.pendientes(5000)[0][0]["event_id"], primero["event_id"])

    def test_terminado_lo_quita(self):
        self.cola.agregar("a", {}, 0)
        evento, _ = self.cola.pendientes(1)[0]
        self.cola.terminado(evento)
        self.assertEqual(len(self.cola), 0)
        self.cola.terminado(evento)         # quitar de nuevo no falla

    def test_reintentar_espera_y_detiene_a_los_siguientes(self):
        self.cola.agregar("a", {}, 0)
        self.cola.agregar("b", {}, 0)
        primero, _ = self.cola.pendientes(100)[0]
        self.cola.reintentar(primero, 100)
        self.assertEqual(self.cola.pendientes(100 + ce.ESPERA_REINTENTO_MS - 1), [])
        lista = self.cola.pendientes(100 + ce.ESPERA_REINTENTO_MS)
        self.assertEqual([e["tipo"] for e, _ in lista], ["a", "b"])

    def test_un_evento_vencido_se_descarta(self):
        self.cola.agregar("a", {}, 0)
        self.cola.agregar("b", {}, ce.VIDA_MS)
        lista = self.cola.pendientes(ce.VIDA_MS + 1)
        self.assertEqual([e["tipo"] for e, _ in lista], ["b"])
        self.assertEqual(len(self.cola), 1)

    def test_tope_descarta_el_mas_antiguo(self):
        for n in range(ce.MAXIMO + 3):
            self.cola.agregar("t%d" % n, {}, n)
        tipos = [e["tipo"] for e, _ in self.cola.pendientes(ce.MAXIMO + 3)]
        self.assertEqual(len(tipos), ce.MAXIMO)
        self.assertEqual(tipos[0], "t3")
        self.assertEqual(tipos[-1], "t%d" % (ce.MAXIMO + 2))

    def test_vuelta_del_contador_de_ticks(self):
        cerca_del_final = ce.PERIODO_TICKS - 500
        self.cola.agregar("a", {}, cerca_del_final)
        lista = self.cola.pendientes(1500)        # el contador dio la vuelta
        self.assertEqual(len(lista), 1)
        self.assertEqual(lista[0][1], 2)
        evento = lista[0][0]
        self.cola.reintentar(evento, ce.PERIODO_TICKS - 100)
        self.assertEqual(self.cola.pendientes(ce.PERIODO_TICKS - 50), [])
        self.assertEqual(len(self.cola.pendientes(ce.ESPERA_REINTENTO_MS)), 1)

    def test_una_edad_negativa_vale_cero(self):
        self.cola.agregar("a", {}, 5000)
        self.assertEqual(self.cola.pendientes(4000)[0][1], 0)

    def test_vaciar(self):
        self.cola.agregar("a", {}, 0)
        self.cola.vaciar()
        self.assertEqual(self.cola.pendientes(1), [])


if __name__ == "__main__":
    unittest.main()
