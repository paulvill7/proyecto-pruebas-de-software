/**
 * @jest-environment node
 */
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const express = require('express');
const http = require('http');

const appPath = path.resolve(__dirname, '..' );
const port = 3001;
const LOGIN_URL = `http://localhost:${port}/index.html`;

jest.setTimeout(30000);

describe('CP-07: Login Web (Prueba E2E)', () => {
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
    });

    afterAll(async () => {
        await driver.quit();
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(async () => {
        // Navigate first to be on the origin to clear storage
        await driver.get(LOGIN_URL);
        await driver.executeScript(`
            sessionStorage.clear();
            localStorage.clear();
            if (typeof Auth !== 'undefined') Auth.seedDefault();
        `);
        // Navigate again to be sure we are on the login page
        await driver.get(LOGIN_URL);
        await driver.wait(until.elementLocated(By.id('btnLogin')), 10000);
    });

    test('Debe iniciar sesión correctamente con credenciales válidas', async () => {
        // 1. Ingresar credenciales válidas (IDs reales: iUser, iPass)
        await driver.findElement(By.id('iUser')).sendKeys('admin');
        await driver.findElement(By.id('iPass')).sendKeys('admin123');

        // 2. Hacer clic en "Iniciar sesión"
        await driver.findElement(By.id('btnLogin')).click();

        // 3. Esperar a que aparezca el toast de bienvenida (login tiene setTimeout de 500ms)
        await driver.wait(async () => {
            const toast = await driver.findElement(By.id('toast'));
            const classes = await toast.getAttribute('class');
            return classes.includes('show');
        }, 10000);

        // 4. Validar que el toast muestra mensaje de bienvenida
        const toastTitle = await driver.findElement(By.id('toastTitle'));
        const mensaje = await toastTitle.getText();
        expect(mensaje).toContain('Bienvenido');

        // 5. Validar que la sesión se guardó correctamente
        const session = await driver.executeScript(
            'return sessionStorage.getItem("642_session");'
        );
        expect(session).not.toBeNull();
        const data = JSON.parse(session);
        expect(data.username).toBe('admin');
    }, 15000);

    test('Debe mostrar error con credenciales incorrectas', async () => {
        await driver.findElement(By.id('iUser')).sendKeys('admin');
        await driver.findElement(By.id('iPass')).sendKeys('contraseñamal');
        await driver.findElement(By.id('btnLogin')).click();

        // esperar toast de error
        await driver.wait(async () => {
            const toast = await driver.findElement(By.id('toast'));
            const classes = await toast.getAttribute('class');
            return classes.includes('show');
        }, 10000);

        const toastTitle = await driver.findElement(By.id('toastTitle'));
        expect(await toastTitle.getText()).toContain('Error');

        // no debe haber sesión
        const session = await driver.executeScript(
            'return sessionStorage.getItem("642_session");'
        );
        expect(session).toBeNull();
    }, 15000);

    test('Debe mostrar errores de validación con campos vacíos', async () => {
        // clic sin llenar campos
        await driver.findElement(By.id('btnLogin')).click();

        // esperar errores de validación
        await driver.wait(async () => {
            const err = await driver.findElement(By.id('errUser'));
            const classes = await err.getAttribute('class');
            return classes.includes('show');
        }, 5000);

        const errUser = await driver.findElement(By.id('errUser'));
        expect(await errUser.getText()).toContain('usuario');

        const errPass = await driver.findElement(By.id('errPass'));
        expect(await errPass.getText()).toContain('contraseña');
    }, 10000);
});