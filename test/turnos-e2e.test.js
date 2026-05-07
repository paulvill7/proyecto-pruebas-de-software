/**
 * @jest-environment node
 */
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const express = require('express');
const http = require('http');

const appPath = path.resolve(__dirname, '..');
const port = 3003; // diferente puerto para evitar conflictos
const LOGIN_URL = `http://localhost:${port}/index.html`;
const TURNOS_URL = `http://localhost:${port}/pages/turnos.html`;

jest.setTimeout(30000);

describe('CP-09: Gestión de Turnos (Prueba E2E)', () => {
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

    // Iniciar un servidor de archivos estaticos para las pruebas
    const app = express();
    app.use(express.static(appPath));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(port, resolve));

    // seedear usuario, datos demo e inyectar sesion
    await driver.get(LOGIN_URL);
    await driver.executeScript(`
            sessionStorage.clear();
            localStorage.clear();
            if (typeof Auth !== 'undefined') Auth.seedDefault();
            if (typeof DB !== 'undefined') DB.seedAll();
        `);
  });

  afterAll(async () => {
    if (driver) await driver.quit();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(async () => {
    await driver.get(LOGIN_URL);
    // se asegura de tener una sesion activa y se navega a turnos
    await driver.executeScript(`
            sessionStorage.setItem('642_session', JSON.stringify({
                id: 1, nombre: 'Administrador', username: 'admin', rol: 'Administrador'
            }));
        `);
    await driver.get(TURNOS_URL);
    await driver.wait(until.elementLocated(By.id('btnNuevo')), 10000);
  });

  test('Debe registrar un nuevo turno correctamente y mostrar éxito', async () => {
    // 1 dar clic en "Nuevo turno"
    const btnNuevo = await driver.findElement(By.id('btnNuevo'));
    await btnNuevo.click();

    // esperar a que el modal se abra
    await driver.wait(async () => {
      const modal = await driver.findElement(By.id('modal'));
      const classes = await modal.getAttribute('class');
      return classes.includes('open');
    }, 5000);

    // 2 completar el formulario
    // seleccionar fotografo (el primer usuario disponible despues del placeholder)
    const fFotografo = await driver.findElement(By.id('fFotografo'));
    const fotografoOpts = await fFotografo.findElements(By.tagName('option'));
    // fotografoOpts[0] es "Selecciona fotografo..."
    if (fotografoOpts.length > 1) {
      await fotografoOpts[1].click();
    } else {
      throw new Error('No photographers available in the select');
    }

    // fecha (hoy)
    const hoy = new Date().toISOString().split('T')[0];
    await driver.executeScript(`document.getElementById('fFecha').value = '${hoy}'`);

    // horas (inicio 10:00, fin 18:00)
    await driver.executeScript(`document.getElementById('fInicio').value = '10:00'`);
    await driver.executeScript(`document.getElementById('fFin').value = '18:00'`);

    // estado (libre)
    const fEstado = await driver.findElement(By.id('fEstado'));
    await fEstado.findElement(By.css('option[value="libre"]')).click();

    // notas
    const fNotas = await driver.findElement(By.id('fNotas'));
    await fNotas.sendKeys('Turno de prueba E2E');

    // 3 hacer clic en "Guardar"
    await driver.findElement(By.id('btnGuardar')).click();

    // 4 verificar que aparezca el toast de éxito
    await driver.wait(async () => {
      const toast = await driver.findElement(By.id('toast'));
      const classes = await toast.getAttribute('class');
      return classes.includes('show');
    }, 5000);

    const toastTitle = await driver.findElement(By.id('toastTitle'));
    const mensaje = await toastTitle.getText();
    expect(mensaje).toContain('Turno registrado');

    // 5 verificar que se guardo en localStorage
    const turnos = await driver.executeScript(
      'return JSON.parse(localStorage.getItem("642_turnos") || "[]");'
    );
    expect(turnos.length).toBeGreaterThan(0);

    const ultimoTurno = turnos[turnos.length - 1];
    expect(ultimoTurno.notas).toBe('Turno de prueba E2E');
    expect(ultimoTurno.estado).toBe('libre');
  }, 15000);
});