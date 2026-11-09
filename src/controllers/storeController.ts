import { Request, Response } from "express";
import { pgPool, isPostgresConnected } from "../config/postgres";

/**
 * CONTROLADOR CRUD: TIENDA / PEDIDOS (MODELO RELACIONAL POSTGRESQL)
 * Maneja las operaciones Create, Read, Update, Delete para:
 * - Clientes (Entidad Fuerte, PK: dni)
 * - Artículos (Entidad Fuerte, PK: num_serie)
 * - Pedidos (Entidad, 1:N con Clientes)
 * - Detalle Pedidos (Tabla Intermedia N:M con atributo 'cantidad')
 */

// ============================================================================
// 0. INICIALIZACIÓN AUTOMÁTICA DE TABLAS
// ============================================================================
export const initStoreDatabase = async (req: Request, res: Response) => {
  if (!isPostgresConnected()) {
    return res.status(503).json({
      status: "error",
      message: "PostgreSQL no está conectado en el puerto 5432. Verifica que el servicio esté corriendo en Windows (services.msc) y que las credenciales en .env sean correctas."
    });
  }

  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        dni VARCHAR(20) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        telefono VARCHAR(20),
        direccion TEXT,
        fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id_pedido SERIAL PRIMARY KEY,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        cliente_dni VARCHAR(20) NOT NULL,
        estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'cancelado')),
        total NUMERIC(12, 2) DEFAULT 0.00 CHECK (total >= 0),
        CONSTRAINT fk_pedido_cliente FOREIGN KEY (cliente_dni) REFERENCES clientes(dni) ON UPDATE CASCADE ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS articulos (
        num_serie VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
      );

      CREATE TABLE IF NOT EXISTS pedido_articulos (
        id_pedido INTEGER NOT NULL,
        num_serie VARCHAR(50) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
        precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
        PRIMARY KEY (id_pedido, num_serie),
        CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
        CONSTRAINT fk_detalle_articulo FOREIGN KEY (num_serie) REFERENCES articulos(num_serie) ON UPDATE CASCADE ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_dni);
      CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
      CREATE INDEX IF NOT EXISTS idx_detalle_articulo ON pedido_articulos(num_serie);
    `);

    res.json({
      status: "success",
      message: "Tablas del modelo Entidad-Relación creadas exitosamente en PostgreSQL."
    });
  } catch (error) {
    console.error("Error al inicializar tablas:", error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// ============================================================================
// 1. CRUD CLIENTES (PK: dni)
// ============================================================================
export const getClientes = async (req: Request, res: Response) => {
  try {
    const result = await pgPool.query("SELECT * FROM clientes ORDER BY nombre ASC;");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getClienteByDni = async (req: Request, res: Response) => {
  const { dni } = req.params;
  try {
    const result = await pgPool.query("SELECT * FROM clientes WHERE dni = $1;", [dni]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const createCliente = async (req: Request, res: Response) => {
  const { dni, nombre, email, telefono, direccion } = req.body;
  if (!dni || !nombre) {
    return res.status(400).json({ message: "DNI y Nombre son campos obligatorios." });
  }

  try {
    const query = `
      INSERT INTO clientes (dni, nombre, email, telefono, direccion)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pgPool.query(query, [dni, nombre, email, telefono, direccion]);
    res.status(201).json({ message: "Cliente creado exitosamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
  const { dni } = req.params;
  const { nombre, email, telefono, direccion } = req.body;

  try {
    const query = `
      UPDATE clientes
      SET nombre = COALESCE($1, nombre),
          email = COALESCE($2, email),
          telefono = COALESCE($3, telefono),
          direccion = COALESCE($4, direccion)
      WHERE dni = $5
      RETURNING *;
    `;
    const result = await pgPool.query(query, [nombre, email, telefono, direccion, dni]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    res.json({ message: "Cliente actualizado exitosamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  const { dni } = req.params;
  try {
    const result = await pgPool.query("DELETE FROM clientes WHERE dni = $1 RETURNING *;", [dni]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    res.json({ message: "Cliente eliminado correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ 
      message: "No se puede eliminar el cliente porque tiene pedidos asociados (Integridad Referencial RESTRICT).",
      detail: (error as Error).message 
    });
  }
};

// ============================================================================
// 2. CRUD ARTÍCULOS (PK: num_serie)
// ============================================================================
export const getArticulos = async (req: Request, res: Response) => {
  try {
    const result = await pgPool.query("SELECT * FROM articulos ORDER BY nombre ASC;");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const createArticulo = async (req: Request, res: Response) => {
  const { num_serie, nombre, descripcion, precio, stock } = req.body;
  if (!num_serie || !nombre || precio === undefined) {
    return res.status(400).json({ message: "Número de Serie, Nombre y Precio son obligatorios." });
  }

  try {
    const query = `
      INSERT INTO articulos (num_serie, nombre, descripcion, precio, stock)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pgPool.query(query, [num_serie, nombre, descripcion, precio, stock || 0]);
    res.status(201).json({ message: "Artículo creado exitosamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

export const updateArticulo = async (req: Request, res: Response) => {
  const { numSerie } = req.params;
  const { nombre, descripcion, precio, stock } = req.body;

  try {
    const query = `
      UPDATE articulos
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          precio = COALESCE($3, precio),
          stock = COALESCE($4, stock)
      WHERE num_serie = $5
      RETURNING *;
    `;
    const result = await pgPool.query(query, [nombre, descripcion, precio, stock, numSerie]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Artículo no encontrado" });
    }
    res.json({ message: "Artículo actualizado", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

export const deleteArticulo = async (req: Request, res: Response) => {
  const { numSerie } = req.params;
  try {
    const result = await pgPool.query("DELETE FROM articulos WHERE num_serie = $1 RETURNING *;", [numSerie]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Artículo no encontrado" });
    }
    res.json({ message: "Artículo eliminado", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ 
      message: "No se puede eliminar el artículo porque está incluido en uno o más pedidos.",
      detail: (error as Error).message 
    });
  }
};

// ============================================================================
// 3. CRUD PEDIDOS Y DETALLES (TRANSACCIÓN ATÓMICA N:M)
// ============================================================================

/**
 * Obtener todos los pedidos con los datos del Cliente y sus Artículos (JOIN + JSON_AGG)
 */
export const getPedidos = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        p.id_pedido,
        p.fecha,
        p.estado,
        p.total,
        c.dni AS cliente_dni,
        c.nombre AS cliente_nombre,
        c.email AS cliente_email,
        c.telefono AS cliente_telefono,
        COALESCE(
          json_agg(
            json_build_object(
              'num_serie', a.num_serie,
              'nombre', a.nombre,
              'cantidad', pa.cantidad,
              'precio_unitario', pa.precio_unitario,
              'subtotal', (pa.cantidad * pa.precio_unitario)
            )
          ) FILTER (WHERE a.num_serie IS NOT NULL),
          '[]'::json
        ) AS articulos
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_dni = c.dni
      LEFT JOIN pedido_articulos pa ON p.id_pedido = pa.id_pedido
      LEFT JOIN articulos a ON pa.num_serie = a.num_serie
      GROUP BY p.id_pedido, c.dni, c.nombre, c.email, c.telefono
      ORDER BY p.fecha DESC;
    `;
    const result = await pgPool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

/**
 * Obtener un pedido específico por ID
 */
export const getPedidoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        p.id_pedido,
        p.fecha,
        p.estado,
        p.total,
        c.dni AS cliente_dni,
        c.nombre AS cliente_nombre,
        c.email AS cliente_email,
        c.telefono AS cliente_telefono,
        COALESCE(
          json_agg(
            json_build_object(
              'num_serie', a.num_serie,
              'nombre', a.nombre,
              'cantidad', pa.cantidad,
              'precio_unitario', pa.precio_unitario,
              'subtotal', (pa.cantidad * pa.precio_unitario)
            )
          ) FILTER (WHERE a.num_serie IS NOT NULL),
          '[]'::json
        ) AS articulos
      FROM pedidos p
      INNER JOIN clientes c ON p.cliente_dni = c.dni
      LEFT JOIN pedido_articulos pa ON p.id_pedido = pa.id_pedido
      LEFT JOIN articulos a ON pa.num_serie = a.num_serie
      WHERE p.id_pedido = $1
      GROUP BY p.id_pedido, c.dni, c.nombre, c.email, c.telefono;
    `;
    const result = await pgPool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

/**
 * Crear un nuevo Pedido con Artículos en una TRANSACCIÓN ACID
 * Body esperado:
 * {
 *   "cliente_dni": "10203040",
 *   "articulos": [
 *     { "num_serie": "ART-001", "cantidad": 2 },
 *     { "num_serie": "ART-003", "cantidad": 1 }
 *   ]
 * }
 */
export const createPedido = async (req: Request, res: Response) => {
  const { cliente_dni, articulos } = req.body;

  if (!cliente_dni || !articulos || !Array.isArray(articulos) || articulos.length === 0) {
    return res.status(400).json({ 
      message: "Se requiere 'cliente_dni' y un arreglo 'articulos' con al menos un elemento." 
    });
  }

  const client = await pgPool.connect();

  try {
    await client.query("BEGIN"); // Iniciar Transacción ACID

    // 1. Verificar existencia del cliente
    const clienteCheck = await client.query("SELECT dni FROM clientes WHERE dni = $1;", [cliente_dni]);
    if (clienteCheck.rows.length === 0) {
      throw new Error(`El cliente con DNI '${cliente_dni}' no existe.`);
    }

    // 2. Insertar cabecera de Pedido
    const pedidoInsert = await client.query(
      `INSERT INTO pedidos (fecha, cliente_dni, estado, total)
       VALUES (NOW(), $1, 'pendiente', 0.00)
       RETURNING id_pedido, fecha, estado;`,
      [cliente_dni]
    );
    const nuevoIdPedido = pedidoInsert.rows[0].id_pedido;

    let totalCalculado = 0;

    // 3. Procesar cada artículo (Validar stock, capturar precio, insertar en pedido_articulos y actualizar stock)
    for (const item of articulos) {
      const { num_serie, cantidad } = item;

      if (!num_serie || !cantidad || cantidad <= 0) {
        throw new Error("Cada artículo debe tener 'num_serie' válido y 'cantidad' mayor a 0.");
      }

      // Consultar artículo con bloqueo de fila (FOR UPDATE) para prevenir condiciones de carrera
      const artResult = await client.query(
        "SELECT precio, stock FROM articulos WHERE num_serie = $1 FOR UPDATE;",
        [num_serie]
      );

      if (artResult.rows.length === 0) {
        throw new Error(`Artículo con número de serie '${num_serie}' no existe.`);
      }

      const { precio, stock } = artResult.rows[0];

      if (stock < cantidad) {
        throw new Error(`Stock insuficiente para el artículo '${num_serie}'. Disponible: ${stock}, Solicitado: ${cantidad}`);
      }

      const precioUnitario = parseFloat(precio);
      const subtotal = precioUnitario * cantidad;
      totalCalculado += subtotal;

      // Insertar detalle en pedido_articulos (Tabla N:M)
      await client.query(
        `INSERT INTO pedido_articulos (id_pedido, num_serie, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4);`,
        [nuevoIdPedido, num_serie, cantidad, precioUnitario]
      );

      // Descontar inventario
      await client.query(
        "UPDATE articulos SET stock = stock - $1 WHERE num_serie = $2;",
        [cantidad, num_serie]
      );
    }

    // 4. Actualizar el total del Pedido
    await client.query(
      "UPDATE pedidos SET total = $1 WHERE id_pedido = $2;",
      [totalCalculado, nuevoIdPedido]
    );

    await client.query("COMMIT"); // Confirmar transacción exitosa

    res.status(201).json({
      message: "Pedido creado y procesado exitosamente.",
      pedido: {
        id_pedido: nuevoIdPedido,
        cliente_dni,
        total: totalCalculado,
        articulos_count: articulos.length
      }
    });

  } catch (error) {
    await client.query("ROLLBACK"); // Revertir todo en caso de error
    console.error("Transacción abortada:", error);
    res.status(400).json({ message: (error as Error).message });
  } finally {
    client.release();
  }
};

/**
 * Actualizar estado de un Pedido
 */
export const updatePedidoEstado = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado } = req.body;

  const validEstados = ['pendiente', 'pagado', 'enviado', 'cancelado'];
  if (!estado || !validEstados.includes(estado)) {
    return res.status(400).json({ message: `Estado inválido. Valores permitidos: ${validEstados.join(", ")}` });
  }

  try {
    const result = await pgPool.query(
      "UPDATE pedidos SET estado = $1 WHERE id_pedido = $2 RETURNING *;",
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    res.json({ message: "Estado de pedido actualizado", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

/**
 * Eliminar un Pedido (Eliminación en Cascada de sus artículos)
 */
export const deletePedido = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pgPool.query("DELETE FROM pedidos WHERE id_pedido = $1 RETURNING *;", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }
    res.json({ message: "Pedido eliminado exitosamente", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// ============================================================================
// 4. SEED DATA PARA PRUEBAS RÁPIDAS
// ============================================================================
export const seedStoreData = async (req: Request, res: Response) => {
  try {
    await pgPool.query(`
      INSERT INTO clientes (dni, nombre, email, telefono, direccion)
      VALUES 
        ('10203040', 'Carlos Mendoza', 'carlos.m@example.com', '3001234567', 'Calle 45 # 12-30, Bogotá'),
        ('50607080', 'Laura Gómez', 'laura.g@example.com', '3109876543', 'Cra 15 # 80-22, Medellín'),
        ('90102030', 'Andrés Pastrana', 'andres.p@example.com', '3155554433', 'Av 6 # 23-11, Cali')
      ON CONFLICT (dni) DO NOTHING;

      INSERT INTO articulos (num_serie, nombre, descripcion, precio, stock)
      VALUES 
        ('ART-001', 'Kit de Supervivencia Sísmica', 'Botiquín, linterna dinamo, radio AM/FM y manta térmica', 145000.00, 50),
        ('ART-002', 'Radio Solar de Emergencia', 'Receptor de alertas sísmicas y batería externa 5000mAh', 95000.00, 30),
        ('ART-003', 'Filtro Portátil de Agua', 'Elimina 99.9% de bacterias para uso en emergencias', 80000.00, 100),
        ('ART-004', 'Mochila Táctica 40L', 'Impermeable con compartimentos modulares', 120000.00, 25)
      ON CONFLICT (num_serie) DO NOTHING;
    `);

    res.json({ message: "Datos de prueba (Clientes y Artículos) insertados correctamente." });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

