-- ============================================================================
-- SCRIPT DDL Y DML: MOTOR DE BASE DE DATOS RELACIONAL (POSTGRESQL)
-- Modelo Entidad-Relación: Cliente - Pedido - Artículo
-- ============================================================================

-- 1. CREACIÓN DE TABLAS (DDL) CON INTEGRIDAD REFERENCIAL Y RESTRICCIONES

-- 1.1 Entidad Fuerte: CLIENTE
-- Clave Primaria (PK): dni (identificador único del cliente)
CREATE TABLE IF NOT EXISTS clientes (
    dni VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefono VARCHAR(20),
    direccion TEXT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 Entidad: PEDIDO
-- Relación 1:N 'Realiza': Un cliente realiza N pedidos, cada pedido pertenece a 1 cliente.
-- La clave primaria del cliente (dni) se propaga como Clave Foránea (FK) en Pedido.
-- Usamos SERIAL (id_pedido) como identificador subrogado físico para soportar múltiples
-- pedidos de un cliente con fecha y hora exacta.
CREATE TABLE IF NOT EXISTS pedidos (
    id_pedido SERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cliente_dni VARCHAR(20) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'cancelado')),
    total NUMERIC(12, 2) DEFAULT 0.00 CHECK (total >= 0),
    CONSTRAINT fk_pedido_cliente
        FOREIGN KEY (cliente_dni) 
        REFERENCES clientes(dni) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT
);

-- 1.3 Entidad Fuerte: ARTÍCULO
-- Clave Primaria (PK): num_serie (número de serie único de cada artículo)
CREATE TABLE IF NOT EXISTS articulos (
    num_serie VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

-- 1.4 Tabla Asociativa / Intermedia: PEDIDO_ARTICULOS (Relación N:M 'Se compone')
-- Como la relación 'Se compone' es de muchos a muchos (N:M) y posee el atributo propio 'Cantidad',
-- se transforma obligatoriamente en una tabla relacional que hereda las PKs de Pedido y Artículo.
CREATE TABLE IF NOT EXISTS pedido_articulos (
    id_pedido INTEGER NOT NULL,
    num_serie VARCHAR(50) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    PRIMARY KEY (id_pedido, num_serie),
    CONSTRAINT fk_detalle_pedido
        FOREIGN KEY (id_pedido) 
        REFERENCES pedidos(id_pedido) 
        ON DELETE CASCADE,
    CONSTRAINT fk_detalle_articulo
        FOREIGN KEY (num_serie) 
        REFERENCES articulos(num_serie) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT
);

-- Índices para optimizar búsquedas frecuentes y Joins
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_dni);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_articulo ON pedido_articulos(num_serie);

-- ============================================================================
-- 2. OPERACIONES CRUD (CREATE, READ, UPDATE, DELETE) EN SQL PURO
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 CREATE (Inserción de registros)
-- ----------------------------------------------------------------------------

-- Crear Clientes
INSERT INTO clientes (dni, nombre, email, telefono, direccion)
VALUES 
    ('10203040', 'Carlos Mendoza', 'carlos.m@example.com', '3001234567', 'Calle 45 # 12-30, Bogotá'),
    ('50607080', 'Laura Gómez', 'laura.g@example.com', '3109876543', 'Cra 15 # 80-22, Medellín'),
    ('90102030', 'Andrés Pastrana', 'andres.p@example.com', '3155554433', 'Av 6 # 23-11, Cali')
ON CONFLICT (dni) DO NOTHING;

-- Crear Artículos
INSERT INTO articulos (num_serie, nombre, descripcion, precio, stock)
VALUES 
    ('ART-001', 'Kit de Supervivencia Sísmica', 'Botiquín, linterna dinamo, radio AM/FM y manta térmica', 145000.00, 50),
    ('ART-002', 'Radio Solar de Emergencia', 'Receptor de alertas sísmicas y batería externa 5000mAh', 95000.00, 30),
    ('ART-003', 'Filtro Portátil de Agua', 'Elimina 99.9% de bacterias para uso en emergencias', 80000.00, 100),
    ('ART-004', 'Mochila Táctica 40L', 'Impermeable con compartimentos modulares', 120000.00, 25)
ON CONFLICT (num_serie) DO NOTHING;

-- Crear un Pedido con Transacción Atómica (ACID: Pedido + Artículos + Cálculo Total)
DO $$
DECLARE
    nuevo_id_pedido INTEGER;
BEGIN
    -- 1. Insertar cabecera de Pedido
    INSERT INTO pedidos (fecha, cliente_dni, estado, total)
    VALUES (NOW(), '10203040', 'pendiente', 0.00)
    RETURNING id_pedido INTO nuevo_id_pedido;

    -- 2. Insertar Artículos que componen el Pedido (Relación N:M con Cantidad)
    INSERT INTO pedido_articulos (id_pedido, num_serie, cantidad, precio_unitario)
    VALUES 
        (nuevo_id_pedido, 'ART-001', 2, 145000.00),
        (nuevo_id_pedido, 'ART-003', 1, 80000.00);

    -- 3. Actualizar el Total del Pedido basado en la sumatoria de sus artículos
    UPDATE pedidos
    SET total = (
        SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
        FROM pedido_articulos
        WHERE id_pedido = nuevo_id_pedido
    )
    WHERE id_pedido = nuevo_id_pedido;

    -- 4. Descontar Stock de los Artículos
    UPDATE articulos SET stock = stock - 2 WHERE num_serie = 'ART-001';
    UPDATE articulos SET stock = stock - 1 WHERE num_serie = 'ART-003';
END $$;

-- ----------------------------------------------------------------------------
-- 2.2 READ (Lectura y Consultas con JOINs)
-- ----------------------------------------------------------------------------

-- Consultar todos los clientes
SELECT dni, nombre, email, telefono, direccion, fecha_registro 
FROM clientes
ORDER BY nombre ASC;

-- Consultar todos los pedidos con los datos del Cliente y el desglose de Artículos (JSON agregados)
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

-- Consultar un pedido específico por ID
SELECT 
    p.id_pedido,
    p.fecha,
    p.estado,
    p.total,
    c.dni AS cliente_dni,
    c.nombre AS cliente_nombre,
    pa.num_serie,
    a.nombre AS articulo_nombre,
    pa.cantidad,
    pa.precio_unitario,
    (pa.cantidad * pa.precio_unitario) AS subtotal
FROM pedidos p
JOIN clientes c ON p.cliente_dni = c.dni
JOIN pedido_articulos pa ON p.id_pedido = pa.id_pedido
JOIN articulos a ON pa.num_serie = a.num_serie
WHERE p.id_pedido = 1;

-- ----------------------------------------------------------------------------
-- 2.3 UPDATE (Actualización de registros)
-- ----------------------------------------------------------------------------

-- Actualizar datos del Cliente
UPDATE clientes
SET telefono = '3009998877', direccion = 'Carrera 7 # 72-10 Oficina 502, Bogotá'
WHERE dni = '10203040';

-- Actualizar stock y precio de un Artículo
UPDATE articulos
SET precio = 152000.00, stock = stock + 20
WHERE num_serie = 'ART-001';

-- Actualizar estado de un Pedido
UPDATE pedidos
SET estado = 'pagado'
WHERE id_pedido = 1;

-- Actualizar cantidad de un artículo dentro del pedido y recalcular el total
UPDATE pedido_articulos
SET cantidad = 3
WHERE id_pedido = 1 AND num_serie = 'ART-001';

UPDATE pedidos
SET total = (
    SELECT SUM(cantidad * precio_unitario)
    FROM pedido_articulos
    WHERE id_pedido = 1
)
WHERE id_pedido = 1;

-- ----------------------------------------------------------------------------
-- 2.4 DELETE (Eliminación de registros respetando integridad)
-- ----------------------------------------------------------------------------

-- Eliminar un artículo de un pedido en particular
DELETE FROM pedido_articulos
WHERE id_pedido = 1 AND num_serie = 'ART-003';

-- Eliminar un pedido completo (Gracias a ON DELETE CASCADE en pedido_articulos,
-- se eliminan automáticamente las líneas de detalle sin dejar huérfanos)
DELETE FROM pedidos
WHERE id_pedido = 1;

-- Intentar eliminar un cliente con pedidos asociados (ON DELETE RESTRICT previene la eliminación)
-- DELETE FROM clientes WHERE dni = '10203040'; -- Fallará si tiene pedidos activos, garantizando consistencia.

