-- =============================================================
-- Migración 11: Auth — email en usuarios + auditoría de usuario
-- Aplicada: 2026-04-26
-- =============================================================

-- ── 1. Email en usuarios (para login) ────────────────────────
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS email VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);

UPDATE usuarios
SET email = username || '@municipio.gob.ar'
WHERE email IS NULL;

-- ── 2. Columnas de auditoría — tablas administrativas ─────────

ALTER TABLE area
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE subarea
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE tipo_usuario
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE cargos
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE agentes
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE equipos
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE equipo_usuarios
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE servicios
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE tipo_reclamo
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

-- self-ref nullable en usuarios
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS id_usuario_alta         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modificacion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

-- ── 3. BUC: solo id_usuario_alta (modificado_por ya es el mod) ─
ALTER TABLE ciudadanos
    ADD COLUMN IF NOT EXISTS id_usuario_alta INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS id_usuario_alta INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
