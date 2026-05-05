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

describe('CP-03: Registro de Clientes (Prueba de Integración)', () => {
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

    test('Debe crear un nuevo cliente en el sistema correctamente', async () => {
        const nuevoCliente = {
            nombre: 'Estudio de Prueba',
            email: 'contacto@estudioprueba.com',
            telefono: '6621234567'
        };

        // simular la respuesta del insert en la bd
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                nombre: 'Estudio de Prueba',
                telefono: '6621234567',
                email: 'contacto@estudioprueba.com',
                notas: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]
        });

        const response = await request(app)
            .post('/api/clientes')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(nuevoCliente);

        //se espera codigo 201 (creado)
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.nombre).toBe('Estudio de Prueba');
    });

    test('Debe poder consultar la lista general de clientes', async () => {
        // simular la respuesta del select de clientes
        db.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    nombre: 'Estudio de Prueba',
                    telefono: '6621234567',
                    email: 'contacto@estudioprueba.com',
                    notas: null
                },
                {
                    id: 2,
                    nombre: 'María López',
                    telefono: '6449876543',
                    email: 'maria@email.com',
                    notas: null
                }
            ]
        });

        const response = await request(app)
            .get('/api/clientes')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        // esperamos que la peticion sea exitosa
        expect(response.statusCode).toBe(200);
        // esperamos que la respuesta sea un arreglo de clientes
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    test('Debe obtener un cliente por su ID', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 1,
                nombre: 'Estudio de Prueba',
                telefono: '6621234567',
                email: 'contacto@estudioprueba.com',
                notas: null
            }]
        });

        const response = await request(app)
            .get('/api/clientes/1')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.nombre).toBe('Estudio de Prueba');
        expect(response.body).toHaveProperty('telefono');
    });

    test('Debe devolver 404 al buscar un cliente inexistente', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
            .get('/api/clientes/999')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(response.statusCode).toBe(404);
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar la creación de un cliente sin nombre', async () => {
        const clienteSinNombre = {
            telefono: '6441234567',
            email: 'test@email.com'
        };

        const response = await request(app)
            .post('/api/clientes')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(clienteSinNombre);

        expect(response.statusCode).toBe(400); // 400 bad request
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar peticiones sin token de autenticación', async () => {
        const response = await request(app)
            .get('/api/clientes');
        // sin header authorization

        expect(response.statusCode).toBe(401);
        expect(response.body).toHaveProperty('error');
    });
});