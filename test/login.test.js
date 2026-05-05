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

describe('CP-05: API Rest - Login', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Debe iniciar sesión exitosamente con credenciales válidas y devolver un token', async () => {
        // simular usuario en la base de datos con contraseña hasheada
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

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'password123'
            });

        // se espera que el codigo http sea 200 (ok)
        expect(response.statusCode).toBe(200);
        // se espera que la respuesta incluya un token de autenticación
        expect(response.body).toHaveProperty('token');
        // se espera que la respuesta incluya datos del usuario
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.username).toBe('admin');
    });

    test('Debe rechazar el inicio de sesión con credenciales incorrectas', async () => {
        // simular usuario en la bd (la contraseña real es 'password123')
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

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'contraseñaincorrecta'
            });

        // se espera un codigo 401 (unauthorized)
        expect(response.statusCode).toBe(401);
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar el inicio de sesión con usuario inexistente', async () => {
        // simular que no se encontro el usuario en la bd
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'usuarioquenexiste',
                password: 'password123'
            });

        expect(response.statusCode).toBe(401);
        expect(response.body).toHaveProperty('error');
    });

    test('Debe rechazar el inicio de sesión sin campos requeridos', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({});

        // se espera un codigo 400 (bad request)
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
});