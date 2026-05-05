// configurar variables de entorno antes de importar la app
process.env.JWT_SECRET = '642app_super_secret_key_change_this_in_production';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

const bcrypt = require('bcryptjs');

// mock del modulo de base de datos para no depender de postgresql
jest.mock('../server/db', () => ({
    query: jest.fn(),
    pool: { end: jest.fn() }
}));

const request = require('supertest');
const app = require('../server/index');
const db = require('../server/db');

//pruebas unitarias de validacion
describe('CP-01: Validaciones de Reservas (Prueba Unitaria)', () => {

    //simulacion de la regla de negocio del modelo/controlador
    const validarFechaReserva = (fechaIngresada) => {
        const fechaActual = new Date();
        const fechaReserva = new Date(fechaIngresada);
        return fechaReserva > fechaActual; //retorna true solo si es en el futuro
    };

    test('Debe rechazar una solicitud de reserva con una fecha en el pasado', () => {
        const fechaPasada = '2023-05-10T14:00:00'; //fecha que ya ocurrio
        const esValida = validarFechaReserva(fechaPasada);

        //esperamos que la validacion falle (sea falsa)
        expect(esValida).toBe(false);
    });

    test('Debe aceptar una solicitud de reserva con una fecha futura', () => {
        //calculamos dinamicamente la fecha de mañana para asegurar que siempre sea futuro
        const fechaManana = new Date();
        fechaManana.setDate(fechaManana.getDate() + 5);

        const esValida = validarFechaReserva(fechaManana.toISOString());

        //esperamos que la validacion sea exitosa (verdadera)
        expect(esValida).toBe(true);
    });
});

//pruebas de integracion con la API
describe('CP-07: Módulo de Reservas (Prueba de Integración)', () => {
    let tokenAdmin = '';

    // obtener un token valido antes de las pruebas
    beforeAll(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);

        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                username: 'admin',
                nombre: 'Administrador',
                password_hash: hashedPassword,
                rol: 'Admin'
            }]
        });

        const res = await request(app).post('/api/auth/login').send({
            username: 'admin',
            password: 'password123'
        });

        tokenAdmin = res.body.token;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Debe crear una nueva reserva correctamente', async () => {
        const nuevaReserva = {
            cliente_id: 1,
            cliente_nombre: 'Juan Pérez',
            servicio: 'Sesión fotográfica',
            fecha: '2026-05-15',
            hora: '10:00',
            duracion: 2,
            precio: 3500,
            estado: 'pendiente',
            fotografo: 'Carlos García'
        };

        // simular la respuesta del insert en la bd
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                cliente_id: 1,
                cliente_nombre: 'Juan Pérez',
                servicio: 'Sesión fotográfica',
                fecha: '2026-05-15',
                hora: '10:00',
                duracion: 2,
                precio: 3500,
                estado: 'pendiente',
                fotografo: 'Carlos García',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]
        });

        const response = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(nuevaReserva);

        expect(response.statusCode).toBe(201); // 201 created
        expect(response.body).toHaveProperty('id');
        expect(response.body.servicio).toBe('Sesión fotográfica');
        expect(response.body.cliente_nombre).toBe('Juan Pérez');
    });

    test('Debe consultar la lista de reservas', async () => {
        // simular la respuesta del select de reservas
        db.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    cliente_id: 1,
                    cliente_nombre: 'Juan Pérez',
                    servicio: 'Sesión fotográfica',
                    fecha: '2026-05-15',
                    hora: '10:00',
                    duracion: 2,
                    precio: 3500,
                    estado: 'pendiente',
                    fotografo: 'Carlos García'
                },
                {
                    id: 2,
                    cliente_id: 2,
                    cliente_nombre: 'María López',
                    servicio: 'Evento social',
                    fecha: '2026-05-20',
                    hora: '14:00',
                    duracion: 4,
                    precio: 8000,
                    estado: 'confirmada',
                    fotografo: 'Ana Martínez'
                }
            ]
        });

        const response = await request(app)
            .get('/api/reservas')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        expect(response.body[0]).toHaveProperty('servicio');
    });

    test('Debe rechazar la creación de una reserva sin servicio', async () => {
        const reservaSinServicio = {
            cliente_nombre: 'Juan Pérez',
            fecha: '2026-05-15',
            hora: '10:00'
        };

        const response = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(reservaSinServicio);

        expect(response.statusCode).toBe(400); // 400 bad request
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar la creación de una reserva sin fecha', async () => {
        const reservaSinFecha = {
            cliente_nombre: 'Juan Pérez',
            servicio: 'Sesión fotográfica',
            hora: '10:00'
        };

        const response = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(reservaSinFecha);

        expect(response.statusCode).toBe(400); // 400 bad request
        expect(response.body).toHaveProperty('error');
    });

    test('Debe eliminar una reserva existente', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const response = await request(app)
            .delete('/api/reservas/1')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('message');
    });

    test('Debe rechazar peticiones sin token de autenticación', async () => {
        const response = await request(app)
            .get('/api/reservas');
        // sin header authorization

        expect(response.statusCode).toBe(401);
        expect(response.body).toHaveProperty('error');
    });
});