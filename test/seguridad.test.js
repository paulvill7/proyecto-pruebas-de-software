// configurar variables de entorno antes de importar la app
process.env.JWT_SECRET = '642app_super_secret_key_change_this_in_production';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

// mock del modulo de base de datos para no depender de postgresql (al igual que en el resto de tests)
jest.mock('../server/db', () => ({
    query: jest.fn(),
    pool: { end: jest.fn() }
}));

const request = require('supertest');
const app = require('../server/index');

describe('CP-06: Endpoint protegido sin sesión', () => {

    test('Debe bloquear el acceso a rutas protegidas y devolver error 401 o 403', async () => {
        // hacemos una petición get a una ruta que requiere permisos (ej inventario o reservas)
        const response = await request(app).get('/api/inventario');

        // el test espera que el servidor responda con un codigo 401 (unauthorized) o 403 (forbidden)
        expect([401, 403]).toContain(response.statusCode);

        // validamos que el cuerpo de la respuesta contenga el payload de error del backend
        expect(response.body).toHaveProperty('error');
    });
});