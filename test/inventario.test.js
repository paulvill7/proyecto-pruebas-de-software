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

describe('CP-04: Módulo de Inventario', () => {
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

    test('Debe registrar un nuevo equipo fotográfico correctamente', async () => {
        const nuevoEquipo = {
            nombre: 'Cámara Sony A7III',
            categoria: 'Cámaras',
            stock: 2,
            precio: 15000
        };

        // simular la respuesta del insert en la bd
        db.query.mockResolvedValueOnce({
            rows: [{
                id: 10,
                nombre: 'Cámara Sony A7III',
                categoria: 'Cámaras',
                stock: 2,
                precio: 15000,
                ubicacion: null,
                descripcion: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]
        });

        const response = await request(app)
            .post('/api/inventario')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(nuevoEquipo);

        expect(response.statusCode).toBe(201); // 201 created
        expect(response.body).toHaveProperty('id');
        expect(response.body.nombre).toBe('Cámara Sony A7III');
        expect(response.body.categoria).toBe('Cámaras');
    });

    test('Debe consultar la lista de inventario y encontrar equipos', async () => {
        // simular la respuesta del select de inventario
        db.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 10,
                    nombre: 'Cámara Sony A7III',
                    categoria: 'Cámaras',
                    stock: 2,
                    precio: 15000,
                    ubicacion: 'Estudio A',
                    descripcion: null
                },
                {
                    id: 11,
                    nombre: 'Lente Canon 50mm',
                    categoria: 'Lentes',
                    stock: 3,
                    precio: 5000,
                    ubicacion: 'Estudio B',
                    descripcion: null
                }
            ]
        });

        const response = await request(app)
            .get('/api/inventario')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        expect(response.body[0]).toHaveProperty('nombre');
    });

    test('Debe rechazar la creación de un equipo sin nombre', async () => {
        const equipoSinNombre = {
            categoria: 'Cámaras',
            stock: 1,
            precio: 10000
        };

        const response = await request(app)
            .post('/api/inventario')
            .set('Authorization', `Bearer ${tokenAdmin}`)
            .send(equipoSinNombre);

        expect(response.statusCode).toBe(400); // 400 bad request
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar peticiones sin token de autenticación', async () => {
        const response = await request(app)
            .get('/api/inventario');
        // sin header authorization

        expect(response.statusCode).toBe(401);
        expect(response.body).toHaveProperty('error');
    });
});