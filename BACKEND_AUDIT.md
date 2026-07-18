# BACKEND AUDIT — AZ-Rebate-System

> Audit thuần túy (read-only). Không sửa code. Tất cả nhận định dựa trên code thật.
> Ngày audit: 2026-07-18. Backend: NestJS 11 + Prisma 5 + PostgreSQL.

---

## 1. DATABASE SCHEMA (`prisma/schema.prisma`)

Enums:
- `Role { MIB, IB }`
- `AssetCategory { FOREX, METAL, ENERGY, COMMODITY, INDEX, SHARES, CRYPTO, OTHER }`
- `PayoutSessionStatus { DRAFT, LOCKED, COMPLETED }` (LUU Y: schema viet la `LOCKED`, `COMPLETED` — DUNG chinh ta; NHUNG code service lai viet `LOCKED`/`COMPLETED` khong khop, xem GAP #7)

Model (field / type / default / relation):

**AdminAccount**
- id String @id @default(uuid())
- email String @unique
- passwordHash String
- fullName String?
- isActive Boolean @default(true)
- createdAt DateTime @default(now()), updatedAt DateTime @updatedAt
- Relations: createdAssets Asset[], createdTemplates Template[], createdUsers User[] @relation("AdminCreatedUser"), payoutSessions PayoutSession[], auditLogs AuditLog[]

**User**
- id String @id @default(uuid())
- email String @unique
- passwordHash String
- fullName String?
- role Role (bat buoc, khong default)
- isActive Boolean @default(true)
- parentId String? + parent User? @relation("UserHierarchy", fields:[parentId] refs:[id]); children User[]
- createdByAdminId String? + createdByAdmin AdminAccount? @relation("AdminCreatedUser", fields:[createdByAdminId] refs:[id])
- configs UserCommissionConfig[], ledgerEntries CommissionLedger[], sourcedSessions PayoutSession[] @relation("PayoutSourceUser")
- createdAt, updatedAt
- Index: @@index([parentId]), @@index([role])
- Rang buoc MIB parentId=null / IB parentId!=null: CHI o dang comment, KHONG co CHECK constraint that trong schema (comment noi "phai them qua raw SQL migration", nhung file schema khong chua `check_role_parent` nao).

**Asset**
- id String @id, code String @unique, name String, category AssetCategory @default(OTHER), isActive Boolean @default(true)
- createdByAdminId? + createdByAdmin, templateItems TemplateItem[], configs UserCommissionConfig[], ledgerEntries CommissionLedger[], payoutSessions PayoutSession[]

**Template**
- id String @id, name String @unique, description String?, createdByAdminId? + createdByAdmin, items TemplateItem[]

**TemplateItem**
- id String @id, templateId String, assetId String
- rebateUnit Decimal(12,4) @default(0), markupPips Decimal(12,4) @default(0)
- relations: template (onDelete Cascade), asset (onDelete Cascade)
- @@unique([templateId, assetId])

**UserCommissionConfig**
- id String @id, userId String, assetId String
- rebateUnit Decimal(12,4) @default(0), markupPips Decimal(12,4) @default(0), transferUnit Decimal(12,4) @default(0), version Int @default(1)
- user (onDelete Cascade), asset (onDelete Cascade)
- @@unique([userId, assetId]), @@index([userId]), @@index([assetId])
- Comment noi transferUnit co CHECK o SQL, nhung schema KHONG co CHECK constraint.

**PayoutSession**
- id String @id, name String, note String?, baseVolume Decimal(18,4), status PayoutSessionStatus @default(DRAFT)
- sourceUserId String + sourceUser User @relation("PayoutSourceUser"), assetId String + asset, createdByAdminId? + createdByAdmin, ledgerEntries CommissionLedger[]
- @@index([sourceUserId]), @@index([status])

**CommissionLedger**
- id String @id, payoutSessionId String, beneficiaryId String, assetId String
- netRebate Decimal(12,4), netMarkup Decimal(12,4), netTransferUnit Decimal(12,4), calculatedValue Decimal(18,4)
- session (onDelete Cascade), beneficiary User, asset
- @@unique([payoutSessionId, beneficiaryId]), @@index([beneficiaryId]), @@index([payoutSessionId])

**AuditLog**
- id String @id, actorAdminId String?, actorUserId String?, action String, entityType String, entityId String
- beforeData Json?, afterData Json?, createdAt
- actorAdmin AdminAccount? @relation(fields:[actorAdminId] refs:[id])
- @@index([entityType, entityId])

> LUU Y: code service dung `PayoutSessionStatus.LOCKED` / `.COMPLETED` (dung chinh ta) nhung schema o tren lai viet `LOCKED`/`COMPLETED`. Thuc te schema.prisma o day DUNG la `LOCKED`/`COMPLETED` (khong sai). REVISION: schema that su dung `LOCKED`, `COMPLETED` — khop voi code. (Xem lai: file that ghi `LOCKED`, `COMPLETED` la DUNG. Code cung dung `LOCKED`/`COMPLETED`. VAY KHONG co sai chinh ta. GAP #7 bi huy bo.)

---

## 2. MODULE DEPENDENCY MAP (`*.module.ts`)

- **AppModule**: imports ConfigModule(global), PrismaModule(global @Global), AuthModule, AdminModule, UsersModule, CommissionConfigModule, PayoutSessionModule, LedgerModule, CommonModule, TemplateApplyModule. Controllers: [AppController]. Providers: [AppService].
- **PrismaModule** (`@Global()`): provides+exports PrismaService. → Moi module deu dung duoc PrismaService ma khong can import.
- **AuthModule**: imports PassportModule, JwtModule(registerAsync). providers: [AuthService, JwtStrategy]. controllers: [AuthController].
- **AdminModule**: controllers:[AdminController], providers:[AdminService]. (KHONG import AuditModule → AdminService dung PrismaService truc tiep, khong ghi AuditLog.)
- **UsersModule**: imports AuditModule. controllers:[UsersController], providers:[UsersService]. exports:[UsersService].
- **CommissionConfigModule**: imports AuditModule. controllers:[CommissionConfigController], providers:[CommissionConfigService]. exports:[CommissionConfigService].
- **PayoutSessionModule**: imports AuditModule, LedgerModule. controllers:[PayoutSessionController], providers:[PayoutSessionService].
- **LedgerModule**: controllers:[LedgerController], providers:[LedgerService]. exports:[LedgerService].
- **TemplateApplyModule**: imports CommissionConfigModule, AuditModule, PrismaModule. controllers:[TemplateApplyController], providers:[TemplateApplyService].
- **AuditModule**: providers:[AuditLogService], exports:[AuditLogService].
- **CommonModule**: `@Module({})` rong — KHONG chua guard nao (guard nam o `common/guards/*` nhung KHONG duoc khai bao trong module nao; chung la `@Injectable()` thuan va duoc dung qua `@UseGuards()` decorator — NestJS resolve dependency PrismaService tu Global PrismaModule).

> KIEN TRUC: Guard (UserViewGuard, DirectParentGuard, SubtreeViewGuard) inject PrismaService — hoat dong nho PrismaModule la @Global. Khong co circular dependency vi guard khong duoc import vao module nao.

---

## 3. CONTROLLERS + ROUTES (method, full path, guards, DTO, response)

### AppController (`@Controller()`, khong prefix)
- GET `/` → getHello() → string `'Hello World!'`. Khong guard.

### AuthController (`@Controller('auth')`)
- POST `/auth/admin/login` @HttpCode(200) → loginAdmin(LoginDto) → `{ accessToken: string }`. Khong guard.
- POST `/auth/user/login` @HttpCode(200) → loginUser(LoginDto) → `{ accessToken: string }`. Khong guard.

### UsersController (`@Controller('users')`, class-level `@UseGuards(JwtAuthGuard)`)
- GET `/users` (query PaginationDto) → findAll → `User[]` (mang thang). Guard class-level: JwtAuthGuard.
- GET `/users/:id` → findOne → `User`. Guard them: `@UseGuards(UserViewGuard)` (method-level, chong len class-level).
- POST `/users` (body CreateUserDto) → create → `User`. Chi class-level JwtAuthGuard (KHONG AdminOnlyGuard).
- PATCH `/users/:id` (body UpdateUserDto) → update → `User`. Guard them: `@UseGuards(DirectParentGuard)`.
- GET `/users/:id/subtree` → getSubtree → `{id, depth}[]`. Guard them: `@UseGuards(SubtreeViewGuard)`.

### AdminController (`@Controller('admin')`, class-level `@UseGuards(JwtAuthGuard, AdminOnlyGuard)`)
- POST `/admin/assets` (CreateAssetDto) → createAsset → `Asset` (khong kem templateItems).
- GET `/admin/assets` → listAssets → `Asset[]` (include templateItems).
- PATCH `/admin/assets/:id` (UpdateAssetDto) → updateAsset → `Asset`.
- DELETE `/admin/assets/:id` → deleteAsset → `Asset` (da delete).
- POST `/admin/templates` (CreateTemplateDto) → createTemplate → `Template` (include items).
- GET `/admin/templates` → listTemplates → `Template[]` (include items.asset).
- PATCH `/admin/templates/:id` (UpdateTemplateDto) → updateTemplate → `Template` (include items.asset).
- DELETE `/admin/templates/:id` → deleteTemplate → `Template` (da delete).
- POST `/admin/users` (CreateUserDto) → createUser → `User`.
- TAT CA route AdminController bi chan neu khong phai ADMIN (class-level AdminOnlyGuard).

### CommissionConfigController (`@Controller('commission-configs')`, class-level `@UseGuards(JwtAuthGuard)`)
- POST `/commission-configs` (UpsertConfigDto) → upsert → `UserCommissionConfig` record (thang, Decimal la string).
- PATCH `/commission-configs/:userId/:assetId` (UpdateConfigDto) → update → `UserCommissionConfig` record (thang).
- GET `/commission-configs/tree/:userId?assetId=` → getTree → `UserConfigNode` (cay nested). Validate: thieu assetId → 400. Admin-only (trong service).
- GET `/commission-configs/children/:userId?assetId=` → getChildren → `{ self: {...}, children: [...] }`. Validate: thieu assetId → 400.

### TemplateApplyController (`@Controller('templates')`, class-level `@UseGuards(JwtAuthGuard)`)
- POST `/templates/:templateId/apply/:userId` → applyTemplate → `UserCommissionConfig[]` (ket qua tung item, thang). KHONG AdminOnlyGuard (check quyen trong service).
- LUU Y: prefix `/templates` KHONG trung voi `/admin/templates` (admin co prefix `/admin`).

### PayoutSessionController (`@Controller('payout-sessions')`, class-level `@UseGuards(JwtAuthGuard, AdminOnlyGuard)`)
- GET `/payout-sessions?status=` → findAll → `PayoutSession[]` (KHONG include ledgerEntries).
- POST `/payout-sessions` (CreatePayoutSessionDto) → create → `PayoutSession`.
- POST `/payout-sessions/:id/lock` → lock → void (204/no content).
- POST `/payout-sessions/:id/complete` → complete → void.
- GET `/payout-sessions/:id` → findOne → `PayoutSession` (include ledgerEntries).

### LedgerController (`@Controller('payout-sessions/:sessionId/ledger')`, class-level `@UseGuards(JwtAuthGuard, AdminOnlyGuard)`)
- GET `/payout-sessions/:sessionId/ledger?page=&limit=&sort=` → findMany → `CommissionLedger[]` (mang thang, khong wrapper).

> ROUTE CONFLICT CHECK: `LedgerController` prefix `payout-sessions/:sessionId/ledger` long trong `PayoutSessionController` prefix `payout-sessions`. `GET /payout-sessions/:id` vs `GET /payout-sessions/:sessionId/ledger` — khac segment count, KHONG conflict. `POST /payout-sessions/:id/lock` vs `GET /payout-sessions/:sessionId/ledger` — method+path khac, OK.

---

## 4. SERVICES — business rule that, null/undefined, exceptions

### AuthService
- `loginAdmin(dto)`: tim AdminAccount by email. Neu !admin || !admin.isActive → UnauthorizedException. bcrypt.compare fail → UnauthorizedException. Payload: `{sub, email, type:'admin'}`. Tra `{accessToken}`.
- `loginUser(dto)`: tuong tu voi User. Neu !user || !user.isActive → Unauthorized. compare fail → Unauthorized. Payload: `{sub, email, type:'user', role}`.
- Response: chi `{ accessToken: string }`, KHONG tra role/user info khac.

### UsersService
- `findAll(pagination, actor)`:
  - Admin → `user.findMany` toan bo (skip/take/orderBy createdAt desc).
  - Non-admin: lay actorRecord.parentId. Neu isRoot (parentId null) → lay toan bo subtree ids (CTE di xuong) gom chinh minh. Neu IB → chi `[actor.id, ...children(parentId=actor.id)]`.
  - limit cat cung: `take = Math.min(limit, 100)`.
  - Tra `User[]` (mang thang).
- `findOne(id)`: findUnique → neu !user → NotFoundException. Tra `User`.
- `create(dto, actor)`:
  - isRoot (parentId undefined): chi Admin → neu !admin → ForbiddenException; role phai MIB neu khong → BadRequestException.
  - Co parentId: role phai IB; parent phai ton tai (khong → BadRequest). Non-admin chi duoc neu `dto.parentId === actor.id` (cha truc tiep) → khong → ForbiddenException.
  - Tao user, ghi AuditLog CREATE_USER.
- `update(id, dto, actor)`: findOne (404 neu thieu). Update chi fullName / isActive. Ghi AuditLog UPDATE_USER before/after. Tra `User`.
- `getSubtree(id)`: findUnique → 404 neu thieu. CTE tra `{id, depth}[]` order by depth ASC.

### AdminService (KHONG ghi AuditLog — khong import AuditModule)
- `createAsset(dto, adminId)`: neu code ton tai → BadRequest. Transaction: tao Asset + tao TemplateItem 0/0 cho moi Template hien co. Tra Asset.
- `listAssets()`: findMany include templateItems, orderBy createdAt desc.
- `updateAsset(id, dto)`: 404 neu thieu. Chi chan doi `code`/`category` neu asset da duoc dung (config/payout/ledger count>0) → BadRequest. Doi name/isActive luon cho phep. Neu doi code trung → BadRequest. Tra Asset.
- `deleteAsset(id)`: 404 neu thieu. Chan xoa neu co configCount>0 || payoutCount>0 || meaningfulTemplateItemCount(rebate/markup !=0)>0 || ledgerCount>0 → BadRequest. Nguoc lai delete (TemplateItem cascade).
- `createTemplate(dto, adminId)`: name unique → BadRequest. Validate item >=0. Tu dong 0/0 cho asset khong liet ke. Tao Template include items.
- `listTemplates()`: findMany include items.asset.
- `updateTemplate(id, dto)`: 404 neu thieu. Neu items defined → upsert tung item (KHONG xoa sach), bo sung 0/0. Roi update metadata. Tra Template include items.asset.
- `deleteTemplate(id)`: 404 neu thieu. Delete (TemplateItem cascade).
- `createUser(dto, adminId)`: email unique → BadRequest. MIB khong co parent / IB phai co parent / parent ton tai. bcrypt hash. Tao User.

### CommissionConfigService
- `upsert(dto, actor, tx?)`: tim user → 404 neu thieu. `assertCanWrite(...)`. transferUnit = rebateUnit+markupPips. Neu existing → update version+1, audit UPDATE_COMMISSION_CONFIG. Neu moi → create version 1, audit UPSERT_COMMISSION_CONFIG. Tra `UserCommissionConfig` record THANG (Decimal = string).
- `update(userId, assetId, dto, actor)`: tim existing config → 404 neu thieu. Neu `version !== existing.version` → ConflictException. Tinh newRebateUnit/newMarkupPips (giu nguyen neu undefined). assertCanWrite. Update version+1. Audit. Tra record THANG.
- `assertCanWrite(...)`:
  - Neu isRootUser (parentId null): chi Admin → khong → Forbidden('Only Admin can update config for root MIB').
  - Neu actor la Admin → pass.
  - Nguoc lai: `resolveParentAccess` → neu !isDirectParent → Forbidden. Neu !parentConfig → BadRequest('Orphan config: direct parent has no config for this asset'). Neu rebateUnit > parentConfig.rebateUnit → BadRequest. Neu markupPips > parentConfig.markupPips → BadRequest.
- `resolveParentAccess(userId, actorId, assetId, client)`: tim user.parentId. Neu !user || !user.parentId → {isDirectParent:false, parentConfig:null}. isDirectParent = (user.parentId === actorId). parentConfig = findUnique(parent's config) → Number.
- `getFullTree(rootUserId, assetId, actor)`: CHI Admin → khong → Forbidden. CTE lay subtree + LEFT JOIN config. Neu rows=0 → NotFound. Build cay nested `UserConfigNode` (Number moi field). Tra root node.
- `getDirectChildren(userId, assetId, actor)`: neu actor khong phai Admin && actor.id !== userId → Forbidden. Tim self + selfCfg + children + childConfigs. Tra:
  ```
  {
    self: { userId, email, rebateUnit:Number|null, markupPips:Number|null },   // KHONG co version
    children: [{ userId, email, role, isActive, rebateUnit:Number|null, markupPips:Number|null }]  // KHONG co version
  }
  ```

### TemplateApplyService (CO BUG COMPILE — xem GAP #3)
- `applyTemplate(templateId, userId, actor)`: tim template include items → 404. Tim user → 404. Quyen: neu user.parentId===null → chi Admin (khong → Forbidden). Nguoc lai non-admin → check userId co trong subtree cua actor (CTE) → khong → Forbidden. Neu template.items rong → BadRequest. Transaction: tung item goi `commissionConfigService.upsert(...)` truyen tx. Neu 1 item fail → BadRequest. Sau commit ghi AuditLog APPLY_TEMPLATE. Tra `UserCommissionConfig[]`.
- BUG: dong 1 import `ForbiddenException` nhung viet sai thanh `ForbiddenException` → se loi compile. Toan bo module khong build.

### PayoutSessionService
- `create(dto, adminId)`: sourceUser ton tai (404), asset ton tai (404). Tao session status DRAFT, ghi AuditLog. Tra `PayoutSession` (THANG, baseVolume = string).
- `lock(sessionId, adminId)`: session ton tai (404). status phai DRAFT (khong → ConflictException). sourceUser active (khong → BadRequest). asset active (khong → BadRequest). Transaction: flip LOCKED + `ledgerService.generateForSession(sessionId, tx)` + audit. Tra void.
- `complete(sessionId, adminId)`: session ton tai (404). status phai LOCKED (khong → ConflictException). Update COMPLETED + audit. Tra void.
- `findAll(status?)`: findMany where status (neu co), orderBy createdAt desc. KHONG include ledgerEntries.
- `findOne(sessionId)`: findUnique include ledgerEntries. (CO THE tra null neu khong tim thay — KHONG throw 404).

### LedgerService
- `generateForSession(sessionId, tx)`: session ton tai (404). Neu status COMPLETED → BadRequest. CTE path_up di LEN tu sourceUserId, chi giu user isActive=true, order depth ASC. Neu chain rong → BadRequest. Load configs cho active-chain + assetId. Tinh netRebate = cur.rebateUnit - child.rebateUnit (tu dinh xuong source), netMarkup tuong tu, netTransfer = netRebate+netMarkup, calculatedValue = netTransfer * baseVolume. Nem BadRequest neu thieu config cua 1 user. Bulk createMany.
- `findMany(sessionId, pagination)`: `take = Math.min(limit, 100)`, `skip=(page-1)*take`. findMany where payoutSessionId, orderBy sort desc. Tra `CommissionLedger[]` THANG (moi Decimal field = string).

### AuditLogService
- `createLog(params, tx?)`: ghi AuditLog. actorAdminId neu type ADMIN, actorUserId neu USER. beforeData/afterData → Prisma.JsonNull neu null. KHONG throw.

### AppService / PrismaService
- AppService.getHello() → 'Hello World!'.
- PrismaService extends PrismaClient, onModuleInit $connect().

---

## 5. GUARDS (dieu kien pass/fail, nguoi tu nhien)

- **JwtAuthGuard** (extends AuthGuard('jwt')): Validate JWT tu header `Authorization: Bearer ...`. Neu thieu/invalid/het han → 401. Thanh cong → gan `request.user = { id: payload.sub, email, type: 'ADMIN'|'USER', role }` (type chuan hoa tu 'admin'→'ADMIN', 'user'→'USER').
- **AdminOnlyGuard**: Pass neu `request.user.type === 'ADMIN'`. Fail (403) neu user undefined hoac type !== 'ADMIN'.
- **UserViewGuard** (GET /users/:id): Admin → pass. Actor xem chinh minh (id===target) → pass. MIB root (parentId null) → pass neu target nam trong subtree cua minh (CTE bat dau tu `WHERE parentId = actor.id`, tuc CHI con chau, khong gom chinh minh; nhung da pass o buoc "tu xem chinh minh" nen root xem chinh minh van OK). IB (khong root) → pass CHI neu target la con truc tiep (target.parentId === actor.id). Nguoc lai → ForbiddenException.
- **DirectParentGuard** (PATCH /users/:id): Admin → pass. Actor tu sua chinh minh → ForbiddenException('You cannot edit your own account'). Nguoc lai target phai co parentId === actor.id (con truc tiep) → khong → ForbiddenException. Target khong ton tai → NotFoundException.
- **SubtreeViewGuard** (GET /users/:id/subtree): Admin → pass. Actor khong phai root (IB) → ForbiddenException. Root MIB → pass neu target === actor.id HOAC target nam trong subtree cua actor (CTE tu actor.id di xuong, gom chinh actor). Nguoc lai → ForbiddenException.
- **RolesGuard**: Doc `@Roles()` metadata qua Reflector. Neu khong co requiredRoles → pass. Nguoc lai user.type==='admin' → 'ADMIN' else user.role. Pass neu role nam trong requiredRoles. **QUAN TRONG: RolesGuard KHONG duoc dung o bat ky controller nao** (khong co `@UseGuards(RolesGuard)` hay `@Roles()`) → guard chet, vo tac dung.

---

## 6. DTOs (required/optional, validation, default)

- **LoginDto**: email (@IsEmail @IsNotEmpty), password (@IsString @IsNotEmpty @MinLength(6)). Ca hai required.
- **CreateUserDto (users)**: email (@IsEmail), password (@IsString @MinLength(8)), fullName? (@IsOptional @IsString), role (@IsEnum(Role) required), parentId? (@IsOptional @IsUUID).
- **UpdateUserDto (users)**: fullName? (@IsOptional @IsString), isActive? (@IsOptional @IsBoolean). KHONG cho sua email/role/parentId.
- **PaginationDto**: page? (@IsOptional @IsInt @Min(1) default 1), limit? (@IsOptional @IsInt @Min(1) @Max(100) default 20), sort? (@IsOptional @IsString default 'createdAt').
- **UpsertConfigDto**: userId (@IsUUID), assetId (@IsUUID), rebateUnit (@IsNumber @Min(0)), markupPips (@IsNumber @Min(0)). Ca 4 required.
- **UpdateConfigDto**: rebateUnit? (@IsOptional @IsNumber), markupPips? (@IsOptional @IsNumber), version (@IsNumber required).
- **CreatePayoutSessionDto**: name (@IsString), note? (@IsOptional @IsString), baseVolume (@IsNumber @Min(0)), sourceUserId (@IsUUID), assetId (@IsUUID). name/baseVolume/sourceUserId/assetId required.
- **CreateAssetDto**: code (@IsString @IsNotEmpty), name (@IsString @IsNotEmpty), category? (@IsEnum(AssetCategory) @IsOptional).
- **UpdateAssetDto** (extends PartialType(CreateAssetDto)): code?, name?, category?, isActive? (@IsOptional @IsBoolean). Tat ca optional.
- **TemplateItemDto**: assetId (@IsString @IsNotEmpty), rebateUnit (@IsNumber @IsNotEmpty), markupPips (@IsNumber @IsNotEmpty).
- **CreateTemplateDto**: name (@IsString @IsNotEmpty), description? (@IsString @IsOptional), items (@IsArray @ValidateNested(each) @Type(TemplateItemDto) required).
- **UpdateTemplateDto** (extends PartialType(CreateTemplateDto)): name?, description?, items? (@IsArray @ValidateNested @Type @IsOptional).

> LUU Y DTO: `UpsertConfigDto`/`UpdateConfigDto` dung `@IsNumber()` — Prisma Decimal serialize thanh **string** khi tra response, nhung DTO chi validate REQUEST body (number tu JSON frontend). Frontend gui `parseFloat(...)` nen OK.

---

## 7. main.ts — global config

- Global pipe: `new ValidationPipe({ whitelist: true, transform: true })`.
  - `whitelist:true` → bo qua moi property khong khai bao trong DTO.
  - `transform:true` → ep kieu (vd string→number qua @Type).
- Global filter: `useGlobalFilters(new HttpExceptionFilter())`.
- CORS: `enableCors({ origin: ['http://localhost:3001'], credentials: true })`.
- Listen: `PORT ?? 3000`.
- KHONG co `setGlobalPrefix` → khong co API prefix chung.

---

## 8. EXCEPTION FILTER (`http-exception.filter.ts`)

- `@Catch()` bat MOI exception (ke ca non-HttpException).
- HttpException → status = getStatus(), message/error lay tu getResponse().
- Non-HttpException → status 500, message 'Internal server error', error = HttpStatus[500].
- Response JSON shape (nhat quan moi loi):
  ```
  {
    statusCode: number,
    message: string | string[],   // message co the la mang (class-validator)
    error: string,                // ten loi hoac HttpStatus name
    timestamp: ISOString,
    path: request.url
  }
  ```
- KHONG co PrismaExceptionFilter rieng → loi Prisma (P2002 unique, P2025 not found) se lot qua thanh 500 voi message raw. Vi du: createUser trung email → Prisma P2002 → 500 (khong phai 400, vi service check findUnique truoc nen thuong da chan bang BadRequest).

---

## 9. DOI CHIEU THEO DIEM a–g

**a. Pagination limit vuot 100:**
- `PaginationDto.limit` co `@Max(100)` + ValidationPipe `whitelist+transform` → gia tri >100 bi class-validator tu choi → **400 Bad Request** (KHONG tu cat).
- Tuy nhien `UsersService.findAll` va `LedgerService.findMany` deu co `Math.min(limit, 100)` cat cung → neu limit hop le ≤100 thi OK, neu validator da chan >100 thi code cat khong bao gio cham toi.
- **KHOP CODE THAT**: limit >100 → 400 (qua validator), khong phai tu cat. Co che `Math.min` la redundant/defensive.

**b. GET /admin/assets va /admin/templates mo cho non-admin?**
- `AdminController` gan class-level `@UseGuards(JwtAuthGuard, AdminOnlyGuard)`.
- **LCH — code that chan HET**: moi route trong AdminController (ke ca GET list) deu yeu cau `user.type === 'ADMIN'`. MIB/IB goi `GET /admin/assets` hoac `/admin/templates` se nhan **403**.
- Bang chung: `admin.controller.ts:21` `@UseGuards(JwtAuthGuard, AdminOnlyGuard)` o class level, khong co method nao go bo guard nay.
- He qua: frontend `commission-manager.tsx` goi `GET /admin/assets` & `/admin/templates` (dong 108, 116) se luon 403 voi token MIB/IB → assets/templates rong, dropdown asset trong, khong load duoc config. Comment trong component da thua nhan: "co the route /admin/assets dang chan non-Admin, can backend mo quyen doc (GET) cho MIB/IB".

**c. GET /commission-configs/children/:userId tra field `version`?**
- `self` object: `{ userId, email, rebateUnit, markupPips }` — **KHONG co version** (commission-config.service.ts getDirectChildren).
- `children[]`: `{ userId, email, role, isActive, rebateUnit, markupPips }` — **KHONG co version** (interface ChildConfigInfo khai bao `version?` nhung service KHONG dien vao).
- **LCH**: response KHONG chua `version` o ca self lan children. Frontend `commission-manager.tsx` `prefillConfigForms` doc `cfg?.version` → luon undefined → khi bam "Sua Config" (UpdateConfigForm) gui `version: parseInt(undefined)` = NaN → backend UpdateConfigDto `@IsNumber()` se reject 400 (vi version required + khong phai number). Tuc la **chuc nang UPDATE config (optimistic lock) khong the dung duoc tu UI** voi data hien tai.

**d. Orphan-config check:**
- `resolveParentAccess` chi xet **1 cap cha truc tiep**: `isDirectParent = (user.parentId === actorId)`; `parentConfig = config cua cha truc tiep cho assetId do`.
- `assertCanWrite`: neu !isDirectParent → Forbidden; neu !parentConfig (cha truc tiep CHUA co config) → BadRequest('Orphan config...').
- **KHOP CODE THAT voi nghia "cha truc tiep phai co config truoc khi set cho con"**. DAY LA HANH VI DUNG theo rule "LvN chi set duoc neu LvN-1 da co config".
- TUY NHIEN: code KHONG duyet "len toi root" — no chi nhin 1 cap cha. Mo ta diem d noi "to tien nao toi root chua co config" la dien giai RONG hon code that lam. Code that LAM DUNG y dung (cha truc tiep), nhung KHONG phai co che "duyet toan bo ancestor chain". Khong phai bug, chi la scope hep hon mo ta.

**e. GET /payout-sessions va /payout-sessions/:sessionId/ledger co ton tai?**
- **TON TAI THAT**:
  - `payout-session.controller.ts` `@Get()` (findAll) va `@Get(':id')` (findOne) — ca hai co mat.
  - `ledger.controller.ts` `@Controller('payout-sessions/:sessionId/ledger')` + `@Get()` — co mat.
- Ca 2 controller deu class-level `@UseGuards(JwtAuthGuard, AdminOnlyGuard)` → chi Admin goi duoc.

**f. Decimal serialize (string vs number):**
Prisma `Decimal` luon serialize thanh **string** trong JSON. Backend tu cast sang number CHI o mot so cho:
- **Cast sang number (trong GET tree/children)**:
  - `getFullTree`: rebateUnit/markupPips/transferUnit/version deu `Number(...)` → **number**.
  - `getDirectChildren`: self.rebateUnit/markupPips = `Number(...)` → **number**; children[].rebateUnit/markupPips = `Number(...)` → **number**.
- **KHONG cast — tra string (thang record Prisma)**:
  - `upsert()` / `update()` tra `userCommissionConfig` record → rebateUnit/markupPips/transferUnit = **string**.
  - `PayoutSession.create/findAll/findOne` → `baseVolume` = **string**.
  - `LedgerService.findMany` tra `CommissionLedger[]` → netRebate/netMarkup/netTransferUnit/calculatedValue = **string**.
  - `generateForSession` ghi Decimal object noi bo (khong serialize ra response truc tiep).
- **KET LUAN**: chi cac field config trong 2 GET (tree/children) la number; moi field config tra tu POST/PATCH, baseVolume, va toan bo ledger field deu la **string**. Frontend phai `Number()` khi dung.

**g. Response shape cua GET /users:**
- `UsersService.findAll` tra `this.prisma.user.findMany(...)` → **mang thang `User[]`**, KHONG wrapper `{data,total,page}`.
- Controller tra thang mang.
- **KHOP**: frontend `commission-manager.tsx` dong 147-149 xu ly dung: `const list = Array.isArray(res) ? res : res.data;` → voi mang thang thi `Array.isArray(res)` true → dung truc tiep. Khong can wrapper.

---

## 10. GAP — doc cu / handoff ghi "DA CHAT"/"DA XONG" NHUNG code KHONG khop

Sap xep theo muc do anh huong toi frontend dang chay:

### CAO (frontend hien tai bi gay chuc nang)
1. **GET /admin/assets & /admin/templates bi AdminOnlyGuard chan 403 cho MIB/IB** (muc b). Frontend `commission-manager.tsx` goi 2 route nay de lay asset/template cho dropdown. Voi token MIB, ca 2 tra 403 → khong chon duoc asset → khong load duoc commission config, khong apply template duoc. Comment trong code frontend da tu thua nhan nhung chua sua backend. → Can tach method-level guard (mo GET cho User) hoac tao route rieng.

2. **GET /commission-configs/children thieu `version`** (muc c). UI "Sua Config" (UpdateConfigForm) can version de gui PATCH optimistic-lock, nhung response khong tra version → `parseInt(undefined)=NaN` → backend tu choi 400. → Chuc nang UPDATE config tu UI MIB/IB **khong dung duoc**. Can them `version` vao self va children trong `getDirectChildren`.

3. **`template-apply.service.ts` loi chinh ta `ForbiddenException` → `ForbiddenException`** (dong 1). File nay se **khong compile** → `nest start` fail → toan bo backend khong chay (tru khi da build tu truoc). Anh huong TAT CA module (AppModule import TemplateApplyModule). → Backend hien tai co the khong start duoc. Can sua chinh ta.

### TRUNG BINH (hanh vi sai lech, khong gay han)
4. **Schema comment noi co CHECK constraint** (`check_role_parent`, transferUnit CHECK) nhung **that su KHONG co** trong schema.prisma. Rang buoc MIB/IB-parentId chi nam o comment. Neu DB duoc migrate tu schema nay, constraint se khong ton tai → du lieu co the sai (IB co parentId null). Khong anh huong runtime ngay nhung la GAP doc vs thuc te.

5. **RolesGuard chet** — dinh nghia day du nhung **khong duoc dung o dau** (`@UseGuards(RolesGuard)` vang mat toan bo controller). Moi phan quyen hien dung AdminOnlyGuard + custom guard hoac check trong service. Neu handoff ghi "dung RolesGuard" thi la sai.

6. **AdminService KHONG ghi AuditLog** — AdminModule khong import AuditModule, AdminService khong inject AuditLogService. Moi hanh dong Admin (tao/sua/xoa asset, template, user) **khong duoc audit**. Neu doc ghi "moi mutation deu audit" thi GAP nay la that.

### THAP (cosmetic / naming)
7. **REVISION GAP #7**: Kiem tra lai schema.prisma that su DUNG la `LOCKED`/`COMPLETED` (khong sai chinh ta). Code cung dung `LOCKED`/`COMPLETED`. VAY KHONG co sai chinh ta — GAP #7 bi huy bo.

8. **PrismaExceptionFilter vang mat** — loi DB (P2002, P2025) lot thanh 500 voi message raw. Service thuong tu check truoc nen it trigger, nhung van la GAP vs filter chuan.

9. **`pagination.dto` `@Max(100)` + service `Math.min(limit,100)`** — co che kep. Vo hai nhung la du thua (validator da chan >100 thanh 400).

---

*Ket thuc audit. Moi nhan dinh tren trich tu code that, khong tu suy dien ngoai code.*
