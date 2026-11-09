import { Router } from "express";
import {
  initStoreDatabase,
  seedStoreData,
  getClientes,
  getClienteByDni,
  createCliente,
  updateCliente,
  deleteCliente,
  getArticulos,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedidoEstado,
  deletePedido
} from "../controllers/storeController";

const router = Router();

// Inicialización de DDL y Carga inicial
router.post("/init-db", initStoreDatabase);
router.post("/seed", seedStoreData);

// CRUD Clientes
router.get("/clientes", getClientes);
router.get("/clientes/:dni", getClienteByDni);
router.post("/clientes", createCliente);
router.put("/clientes/:dni", updateCliente);
router.delete("/clientes/:dni", deleteCliente);

// CRUD Artículos
router.get("/articulos", getArticulos);
router.post("/articulos", createArticulo);
router.put("/articulos/:numSerie", updateArticulo);
router.delete("/articulos/:numSerie", deleteArticulo);

// CRUD Pedidos (y Detalle N:M)
router.get("/pedidos", getPedidos);
router.get("/pedidos/:id", getPedidoById);
router.post("/pedidos", createPedido);
router.patch("/pedidos/:id/estado", updatePedidoEstado);
router.delete("/pedidos/:id", deletePedido);

export default router;

