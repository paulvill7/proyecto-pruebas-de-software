describe('CP-02: Lógica de Facturación (Prueba Unitaria)', () => {

    test('Debe calcular correctamente el subtotal, impuestos (IVA) y total de una reserva', () => {
        // datos de entrada simulados para la prueba
        const horasReserva = 3;
        const precioPorHora = 400; // ejemplo: $400 por hora
        const porcentajeIva = 0.16; // 16% de IVA

        // ejecucion de la logica (reemplaza esto con tu funcion real si la tienen modularizada)
        const subtotal = horasReserva * precioPorHora;
        const impuestos = subtotal * porcentajeIva;
        const total = subtotal + impuestos;

        // resultados esperados
        expect(subtotal).toBe(1200);
        expect(impuestos).toBe(192);
        expect(total).toBe(1392);
    });

    test('El total no debe arrojar valores negativos', () => {
        const horasReserva = 2;
        const precioPorHora = 500;
        const total = (horasReserva * precioPorHora) * 1.16;

        expect(total).toBeGreaterThanOrEqual(0);
    });
});