---
name: Reglas de Desarrollo ZARIS
description: Reglas y directrices obligatorias para el desarrollo de módulos en la suite ZARIS.
---

# Reglas Mandatorias de Desarrollo para ZARIS

Al desarrollar nuevas características o módulos para la suite ZARIS, usted **DEBE** adherirse a estas reglas estrictamente.

## 1. Login Único y Centralizado

El sistema entero (BUP, Agenda, Historia Clínica, CRM, etc.) opera bajo la premisa de **Single Sign-On (Login Único)**.

- **Prohibido:** Crear pantallas de login, modales de autenticación o validaciones de contraseñas de manera individual en cada módulo.
- **Obligatorio:** Toda la autenticación ocurre en `home.html` (o el servicio de auth principal). Los módulos deben asumir que la autenticación ya sucedió y simplemente verificar la existencia de la sesión compartida (ej. chequeando `zaris_session` en `localStorage`). Si no hay sesión, el usuario es redirigido a `home.html`.

## 2. Base Única de Personas (BUP) como Fuente Única de Verdad

Cualquier módulo que requiera registrar interacciones con individuos (pacientes, clientes, usuarios, solicitantes de turnos) **DEBE** consumir la entidad `Persona` desde la BUP.

- **Prohibido:** Crear tablas o entidades separadas para almacenar datos maestros de personas (como DNI, nombre, teléfonos) dentro de un módulo subsidiario.
- **Obligatorio:** Utilizar su llave primaria (ej. `persona_id`) y referenciar siempre a la tabla/fuente original `bds_personas`. Los datos extra específicos de un negocio (ej. Obra Social) pueden añadirse a la BUP si son relevantes globalmente; de lo contrario se referencian externamente, pero el individuo siempre existe primero y únicamente en la BUP.

## 3. Accesos y Roles Modulares (Arquitectura Futura)

Las credenciales son para toda la suite, pero a corto/mediano plazo habrá control de acceso modular.

- Al generar nuevas arquitecturas de seguridad o diseñar los roles, anticipe que los usuarios tendrán un conjunto de permisos que dictarán a qué aplicaciones o módulos de la suite pueden acceder (ej. pueden tener acceso a Consulta en BUP, pero no tener permitido ingresar al módulo CRM).
- Utilice la misma tabla de usuarios y sesiones subyacente, pero añada configuraciones de acceso modulares o banderas (flags) cuando sea requerido.
