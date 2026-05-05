/**
 * @jest-environment node
 */
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const express = require('express');
const http = require('http');

const appPath = path.resolve(__dirname, '..' );
const port = 3002; // different port to avoid conflicts
const LOGIN_URL = `http://localhost:${port}/index.html`;
const RESERVAS_URL = `http://localhost:${port}/pages/reservas.html`;

jest.setTimeout(30000);

describe('CP-08: Creación de Reserva (Prueba E2E)', () => {
    let driver;
    let server;

    beforeAll(async () => {
        const options = new chrome.Options();
        options.addArguments('--headless=new');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--allow-file-access-from-files');

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        // Start a static file server for the tests
        const app = express();
        app.use(express.static(appPath));
        server = http.createServer(app);
        await new Promise(resolve => server.listen(port, resolve));

        // seedear usuario, datos demo e inyectar sesión
        await driver.get(LOGIN_URL);
        await driver.executeScript(`
            sessionStorage.clear();
            localStorage.clear();
            if (typeof Auth !== 'undefined') Auth.seedDefault();
            if (typeof DB !== 'undefined') DB.seedAll();
        `);
    });

    afterAll(async () => {
        await driver.quit();
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(async () => {
        await driver.get(LOGIN_URL);
        // Ensure session is injected and we are logged in before navigating to reservas
        await driver.executeScript(`
            sessionStorage.setItem('642_session', JSON.stringify({
                id: 1, nombre: 'Administrador', username: 'admin', rol: 'Administrador'
            }));
        `);
        await driver.get(RESERVAS_URL);
        await driver.wait(until.elementLocated(By.id('btnNueva')), 10000);
    });

    test('Debe completar el formulario de reserva y mostrar éxito', async () => {
        // 1. Dar clic en "Nueva reserva"
        const btnNueva = await driver.findElement(By.id('btnNueva'));
        await btnNueva.click();

        // esperar a que el modal se abra
        await driver.wait(async () => {
            const modal = await driver.findElement(By.id('modal'));
            const classes = await modal.getAttribute('class');
            return classes.includes('open');
        }, 5000);

        // 2. Completar los campos del formulario modal (usan IDs, no name)
        // seleccionar cliente (segundo option = primer cliente real)
        const fCliente = await driver.findElement(By.id('fCliente'));
        const clienteOpts = await fCliente.findElements(By.tagName('option'));
        await clienteOpts[1].click();

        // seleccionar servicio
        const fServicio = await driver.findElement(By.id('fServicio'));
        const servicioOpts = await fServicio.findElements(By.tagName('option'));
        await servicioOpts[1].click();

        // fecha futura
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const fechaStr = futureDate.toISOString().split('T')[0];
        await driver.executeScript(`document.getElementById('fFecha').value = '${fechaStr}'`);

        // hora
        await driver.executeScript(`document.getElementById('fHora').value = '14:00'`);

        // precio
        const fPrecio = await driver.findElement(By.id('fPrecio'));
        await fPrecio.clear();
        await fPrecio.sendKeys('2500');

        // 3. Hacer clic en "Guardar"
        await driver.findElement(By.id('btnGuardar')).click();

        // 4. Verificar que aparezca el toast de éxito
        await driver.wait(async () => {
            const toast = await driver.findElement(By.id('toast'));
            const classes = await toast.getAttribute('class');
            return classes.includes('show');
        }, 5000);

        const toastTitle = await driver.findElement(By.id('toastTitle'));
        const mensaje = await toastTitle.getText();
        expect(mensaje).toContain('Reserva creada');

        // 5. Verificar que se guardó en localStorage
        const reservas = await driver.executeScript(
            'return JSON.parse(localStorage.getItem("642_reservas") || "[]");'
        );
        expect(reservas.length).toBeGreaterThanOrEqual(4);
    }, 15000);
});