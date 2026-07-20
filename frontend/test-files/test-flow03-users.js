// Test Flow 03 — Admin Users list + tao User, goi API that qua http://localhost:3000
// Chay: node test-flow03-users.js
// Yeu cau backend dang chay, seed accounts da co san.

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

// Chuan hoa response GET /users ve mang, khong doan cung shape
function extractArray(body) {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.items)) return body.items;
    return null;
}

async function main() {
    const adminToken = await login('admin_test@azrebate.com', 'Test@1234', 'admin');

    // 0. Xem thu shape that cua GET /users de doi chieu voi spec da suy doan
    const sample = await call('GET', '/users?page=1&limit=5', adminToken);
    console.log('--- Shape that cua GET /users (doi chieu voi spec) ---');
    console.log(JSON.stringify(sample.body, null, 2).slice(0, 800));
    console.log('--- het shape ---\n');

    const list1 = extractArray(sample.body);
    check('GET /users tra ve duoc mang user (o data/items/hoac goc)', list1 !== null, sample.body);

    // 1. limit=101 -> 400
    const overLimit = await call('GET', '/users?limit=101', adminToken);
    check('GET /users?limit=101 tra ve 400', overLimit.status === 400, overLimit.body);

    // 2. Tao MIB moi (khong parentId)
    const mibEmail = `testflow-mib-${RUN_ID}@test.com`;
    const mibCreate = await call('POST', '/admin/users', adminToken, {
        email: mibEmail, password: 'Test@1234', fullName: `Test MIB ${RUN_ID}`, role: 'MIB',
    });
    check('POST /admin/users tao MIB thanh cong', mibCreate.status === 201 || mibCreate.status === 200, mibCreate.body);
    const mibId = mibCreate.body?.id;

    // 3. Tao IB moi voi parentId = MIB vua tao
    const ibEmail = `testflow-ib-${RUN_ID}@test.com`;
    const ibCreate = await call('POST', '/admin/users', adminToken, {
        email: ibEmail, password: 'Test@1234', fullName: `Test IB ${RUN_ID}`, role: 'IB', parentId: mibId,
    });
    check('POST /admin/users tao IB (co parentId) thanh cong', ibCreate.status === 201 || ibCreate.status === 200, ibCreate.body);
    const ibId = ibCreate.body?.id;

    // 4. Filter theo parentId -> chi thay dung con truc tiep (IB vua tao)
    const filtered = await call('GET', `/users?parentId=${mibId}`, adminToken);
    const filteredList = extractArray(filtered.body);
    check('GET /users?parentId=<mibId> tra ve mang', filteredList !== null, filtered.body);
    if (filteredList) {
        check('Filter parentId chi chua dung con truc tiep (IB vua tao co mat)', filteredList.some(u => u.id === ibId));
        check('Filter parentId KHONG chua chinh MIB cha (chi con, khong phai cha)', !filteredList.some(u => u.id === mibId));
    }

    // 5. Tao user email trung -> loi ro rang
    const dup = await call('POST', '/admin/users', adminToken, {
        email: mibEmail, password: 'Test@1234', fullName: 'Duplicate', role: 'MIB',
    });
    check('POST email trung tra ve 400', dup.status === 400, dup.body);

    console.log(`\n${pass} PASS / ${fail} FAIL`);
    if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('Loi khi chay test:', e); process.exit(1); });