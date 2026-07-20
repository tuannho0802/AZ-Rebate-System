// Test Flow 02 — Admin Asset CRUD, goi API that qua http://localhost:3000
// Chay: node test-flow02-asset-crud.js
// Yeu cau backend dang chay (npm run start:dev), seed accounts da co san.

const BASE = 'http://localhost:3000';
const RUN_ID = Date.now();
let pass = 0, fail = 0;

function check(label, cond, extra) {
    if (cond) { pass++; console.log(`PASS  ${label}`); }
    else { fail++; console.log(`FAIL  ${label}${extra ? '  -> ' + JSON.stringify(extra) : ''}`); }
}

async function login(email, password, type) {
    const res = await fetch(`${BASE}/auth/${type}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Login fail ${email}: ${JSON.stringify(body)}`);
    return body.accessToken;
}

async function call(method, path, token, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
}

async function main() {
    const adminToken = await login('admin_test@azrebate.com', 'Test@1234', 'admin');
    const mibToken = await login('mib@test.com', 'Test@1234', 'user');

    const code = `TESTASSET_${RUN_ID}`;

    // 1. List asset hien dung (bao gom isActive=false neu co san)
    const listBefore = await call('GET', '/admin/assets', adminToken);
    check('GET /admin/assets tra ve mang', Array.isArray(listBefore.body), listBefore.body);

    // 2. Tao asset moi -> xuat hien ngay trong list
    const created = await call('POST', '/admin/assets', adminToken, {
        code, name: `Test Asset ${RUN_ID}`, category: 'OTHER',
    });
    check('POST /admin/assets tao thanh cong (201/200)', created.status === 201 || created.status === 200, created.body);
    const assetId = created.body?.id;

    const listAfterCreate = await call('GET', '/admin/assets', adminToken);
    check('Asset moi xuat hien trong list', listAfterCreate.body.some(a => a.id === assetId));

    // 3. Tao asset trung code -> loi ro rang
    const dup = await call('POST', '/admin/assets', adminToken, {
        code, name: 'Duplicate', category: 'OTHER',
    });
    check('POST trung code tra ve 400', dup.status === 400, dup.body);

    // 4. Sua asset (name/category/isActive)
    const updated = await call('PATCH', `/admin/assets/${assetId}`, adminToken, {
        name: 'Updated Name', category: 'CRYPTO', isActive: false,
    });
    check('PATCH cap nhat thanh cong', updated.status === 200 || updated.status === 201, updated.body);
    check('PATCH tra ve dung name moi', updated.body?.name === 'Updated Name', updated.body);
    check('PATCH tra ve dung isActive moi', updated.body?.isActive === false, updated.body);

    // 5. Non-admin (MIB) khong tao/sua/xoa duoc -> 403 (proxy check cho "khong thay nut")
    const mibCreate = await call('POST', '/admin/assets', mibToken, {
        code: `${code}_MIB`, name: 'Should fail', category: 'OTHER',
    });
    check('Non-admin POST asset -> 403', mibCreate.status === 403, mibCreate.body);

    // 6. Xoa asset -> bien mat khoi list
    const deleted = await call('DELETE', `/admin/assets/${assetId}`, adminToken);
    check('DELETE asset thanh cong', deleted.status === 200 || deleted.status === 204, deleted.body);

    const listAfterDelete = await call('GET', '/admin/assets', adminToken);
    check('Asset da xoa khong con trong list', !listAfterDelete.body.some(a => a.id === assetId));

    console.log(`\n${pass} PASS / ${fail} FAIL`);
    if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('Loi khi chay test:', e); process.exit(1); });