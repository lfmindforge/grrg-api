# Design — POST /auth/register

**Date :** 2026-04-03  
**Issues couvertes :** #14 (validation), #15 (bcrypt), #16 (erreurs explicites)  
**US parente :** #12 — US-001 Inscription email/mot de passe  
**Milestone :** M1 - Setup & Auth

---

## 1. Architecture des modules

```
src/
  user/
    user.entity.ts        (existant — ajout colonne birthdate)
    user.service.ts       (nouveau)
    user.module.ts        (nouveau)
  auth/
    dto/
      register.dto.ts     (nouveau)
    auth.controller.ts    (nouveau)
    auth.service.ts       (nouveau)
    auth.module.ts        (nouveau)
  database/
    migrations/
      1775216576270-CreateUsers.ts  (mis à jour — ajout birthdate)
```

**UserModule** expose `UserService` qui encapsule le repository TypeORM `User`.  
**AuthModule** importe `UserModule` et délègue la persistence à `UserService`.  
**AppModule** importe `AuthModule` et `UserModule`.

---

## 2. Entité User — modification

Ajout d'un champ `birthdate` à l'entité existante :

```typescript
@Column({ type: 'date' })
birthdate!: Date;
```

- Type `date` (pas `timestamp`) — seule la date de naissance est stockée
- `NOT NULL` — obligatoire à l'inscription
- La migration existante `1775216576270-CreateUsers.ts` est mise à jour (pas de nouvelle migration — on est en dev avant toute mise en prod)
- Workflow dev : drop tables → `migration:run` → `seed:dev`

---

## 3. DTO & validation

Fichier : `src/auth/dto/register.dto.ts`

| Champ | Type | Validations |
|-------|------|-------------|
| `email` | `string` | `@IsEmail()` |
| `password` | `string` | `@IsString()`, `@MinLength(8)` |
| `pseudo` | `string` | `@IsString()`, `@Length(3, 50)`, `@Matches(/^[a-zA-Z0-9_-]+$/)` |
| `birthdate` | `string` | `@IsISO8601()` — format `YYYY-MM-DD` |

`ValidationPipe` activé globalement dans `main.ts` avec `whitelist: true`.

La vérification 18+ est une règle métier traitée dans `AuthService`, pas dans le DTO.

**Packages à installer :** `class-validator`, `class-transformer`, `bcrypt`, `@types/bcrypt`

---

## 4. Logique AuthService.register()

Chaîne d'exécution dans l'ordre :

1. `UserService.findByEmail(email)` → `ConflictException` si email déjà utilisé
2. `UserService.findByPseudo(pseudo)` → `ConflictException` si pseudo déjà utilisé
3. Calcul âge : `today - birthdate >= 18 ans` → `UnprocessableEntityException` si mineur
4. `bcrypt.hash(password, 10)`
5. `UserService.create({ email, password_hash, pseudo, birthdate })`
6. Retour `201` avec données publiques du user créé

`UserService` expose : `findByEmail()`, `findByPseudo()`, `create()`.

---

## 5. Réponse & erreurs

### Succès — 201

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "pseudo": "monpseudo",
  "grade": "etincelle",
  "glow_points": 0,
  "birthdate": "1995-06-15",
  "created_at": "2026-04-03T12:00:00.000Z"
}
```

Le champ `password_hash` n'apparaît jamais dans aucune réponse.

### Erreurs

| Cas | HTTP | Message |
|-----|------|---------|
| Champ invalide / manquant | `400` | message automatique class-validator |
| Email déjà utilisé | `409` | `"Email already in use"` |
| Pseudo déjà utilisé | `409` | `"Pseudo already in use"` |
| Utilisateur mineur | `422` | `"You must be at least 18 years old"` |
