# Phase 7: Testing in depth

## Goal

Understand what each of the 364 tests in this repository actually does, when to
reach for each kind, how Testcontainers gives integration tests a real database,
and when a mocking library beats a hand-written fake.

## Why it matters

"We have tests" is not an interesting claim. What separates people is being able
to say *which kind of test catches which kind of bug*, and why the suite is
shaped the way it is.

The tests in this repository also did real work: they are what made it safe to
move fifteen projects between folders and change three target frameworks without
reading every file. Passing identically before and after is the evidence that a
refactor did not change behaviour.

## Concepts

### The pyramid, with this repository's real numbers

```
        6 e2e specs (Playwright)         real browser, minutes, NOT in CI
   ────────────────────────────────
     54 integration tests (xUnit)        real HTTP + real SQL Server, 15s
   ────────────────────────────────
   267 frontend tests (Vitest + RTL)     components, API mocked, ~20s
 ────────────────────────────────────
      43 unit tests (xUnit)              pure logic, no I/O, 71ms
```

The shape is the point: many cheap fast tests, few slow expensive ones. Invert it
and the suite takes forty minutes, and a suite that takes forty minutes stops
being run.

**Unit** answers *is this rule correct?* `CourseRulesTests`, `OrderRulesTests`,
`ValueObjectRulesTests`. No database, no HTTP, no clock.

**Integration** answers *do the pieces work together?* Routing, auth, EF Core
queries, status codes, CSRF. This is where most real bugs live, because most real
bugs are in the seams.

**End to end** answers *does the user flow work?* Slowest, flakiest, fewest.

### Characterization tests

The integration tests here are named `*CharacterizationTests`, and the word is
deliberate. A characterization test pins down what the system *currently* does,
so you can change how it does it without changing what it does.

That is exactly what made the refactors in this repository safe. The test count
was identical before and after, so the behaviour was too.

### Test doubles: the vocabulary

"Mock" is used to mean all of these, which causes endless confusion.

| Kind | What it does |
|---|---|
| **Dummy** | Passed to satisfy a signature, never used |
| **Stub** | Returns canned answers, no logic |
| **Fake** | A real, working implementation, simplified (in-memory instead of a database) |
| **Spy** | A stub that records how it was called |
| **Mock** | Pre-programmed with expectations, and *fails the test* if they are not met |

The important distinction is the last one. A stub answers questions. A mock
asserts about the conversation.

### Hand-written fakes versus a mocking library

This repository currently uses **hand-written fakes** and no mocking library.
`tests/UnitTests/CacheAsideTests.cs` defines `FakeCache`, a real in-memory
`ICacheStore` that also counts writes.

That is a legitimate and often superior choice:

- It reads as ordinary code, with no DSL to learn
- It is reusable across many tests
- It breaks at compile time when the interface changes, rather than silently
  passing with a stale setup
- There is no chance of asserting on a mock's behaviour rather than the system's

A mocking library earns its place when:

- The interface is large and you need only one member
- You need to verify an *interaction* ("was `SendAsync` called exactly once, with
  this argument?") rather than a result
- You need per-test behaviour like "throw on the second call"

The tradeoff: over-mocking produces tests that pass while the system is broken,
because they only ever tested the mock.

### Moq or NSubstitute

Both are mature. Two things to know:

**NSubstitute** has the lighter syntax:

```csharp
var email = Substitute.For<IEmailService>();
email.SendAsync(Arg.Any<string>(), Arg.Any<string>()).Returns(Task.CompletedTask);
// ... act ...
await email.Received(1).SendAsync("a@b.com", Arg.Any<string>());
```

**Moq** is more widely used, and worth being able to read:

```csharp
var email = new Mock<IEmailService>();
email.Setup(x => x.SendAsync(It.IsAny<string>(), It.IsAny<string>()))
     .Returns(Task.CompletedTask);
// ... act ...
email.Verify(x => x.SendAsync("a@b.com", It.IsAny<string>()), Times.Once);
```

**Context worth knowing:** in August 2023 Moq 4.20.0 shipped a dependency
(SponsorLink) that read the local git email address and sent a hash of it to a
remote service. It was removed days later, but a lot of teams moved to
NSubstitute and did not move back. If asked why a project uses one over the
other, that is the honest answer.

This guide uses NSubstitute, and the point of the exercise is to write the same
test both ways and decide for yourself.

### Testcontainers

The usual bad options for testing database code are an in-memory provider (fast,
but does not behave like SQL Server, so it hides real bugs) or a shared test
database (behaves correctly, but tests interfere and it drifts from the schema).

**Testcontainers starts a real SQL Server in Docker, per test run, and throws it
away afterwards.** Real engine, real migrations, real SQL, no shared state.

The cost is that Docker must be running, and startup takes a few seconds. That is
why the container is shared across all test classes rather than created per class.

## What is already here

`tests/IntegrationTests/ApiFactory.cs` is worth reading line by line.

**Starting a real database:**

```csharp
private readonly MsSqlContainer _db = new MsSqlBuilder()
    .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
    .Build();
```

Pinned to a specific major version, deliberately: `latest` would mean tests could
change behaviour without a single line of code changing.

**Pointing the app at it:**

```csharp
Environment.SetEnvironmentVariable("ConnectionStrings__Default", _db.GetConnectionString());
```

This works because `Program.cs` ends its configuration chain with
`AddEnvironmentVariables()`, and later sources win. Environment variables
therefore beat every `appsettings` file. The same mechanism that injects secrets
in production is what points the tests at their container.

**Faking only the external boundary:**

```csharp
services.RemoveAll<IPaymentService>();
services.AddScoped<IPaymentService, FakePaymentService>();
```

This is the key judgement in the whole file. Stripe is replaced, because tests
must not make real network calls to a third party. **Everything else stays real** —
auth, EF Core, migrations, CSRF, rate limiting config, routing. Fake the boundary
you do not own; keep everything you do own.

**Sharing one container across all test classes:**

```csharp
[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
```

xUnit creates one `ApiFactory` for every class in the `api` collection. Without
this, each test class would start its own SQL Server. This single line is why 54
integration tests run in 15 seconds instead of several minutes.

`IAsyncLifetime` gives async setup and teardown, which a constructor cannot.

## Tasks

### 1. Delete the template leftover

`tests/UnitTests/UnitTest1.cs` is the file `dotnet new xunit` generates. It tests
nothing.

```bash
git checkout main && git pull
git checkout -b test/clean-up-and-extend
rm tests/UnitTests/UnitTest1.cs
dotnet test
```

### 2. Write a unit test with a hand-written fake

Find a service in `src/Application` that depends on an interface. Write a test
that constructs it with a hand-written fake, following the `FakeCache` pattern in
`CacheAsideTests.cs`.

Aim for the shape used throughout this repository:

```csharp
[Fact]
public async Task MethodName_condition_expectedOutcome()
{
    // Arrange
    var fake = new FakeThing();
    var sut = new ServiceUnderTest(fake);

    // Act
    var result = await sut.DoWork(input, CancellationToken.None);

    // Assert
    Assert.Equal(expected, result);
}
```

`sut` means "system under test", and naming it that makes every test's subject
obvious at a glance.

### 3. Write the same test with NSubstitute

```bash
cd tests/UnitTests
dotnet add package NSubstitute
```

Rewrite the test from task 2 using `Substitute.For<T>()`. Then compare them
honestly:

- Which is shorter?
- Which is clearer to someone reading it cold?
- Which survives a change to the interface?
- Which would still pass if the production code were broken?

There is no universally correct answer, and having an opinion you can defend is
the point.

### 4. Add a verification-style assertion

Interaction testing is where a mocking library genuinely wins. Write a test that
asserts a dependency *was called*:

```csharp
await something.Received(1).SendAsync(Arg.Is<string>(s => s.Contains("@")));
```

Then ask the harder question: is that assertion valuable, or is it testing the
implementation rather than the behaviour? Interaction tests are the ones that
break every time you refactor. Use them where the interaction *is* the
requirement — "registering a user sends exactly one welcome email" — and not
otherwise.

### 5. Write an integration test

Add a test to an existing `*CharacterizationTests` class. Follow the pattern:

```csharp
[Collection("api")]
public class MyTests(ApiFactory factory)
{
    [Fact]
    public async Task Endpoint_returns_expected_status()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/catalog/stats");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

`[Collection("api")]` is what joins the shared container. Forget it and your class
starts its own SQL Server.

Note that anything unsafe (POST, PATCH, DELETE) needs a login and an `X-CSRF`
header, exactly as a browser would. Read an existing test that does this before
writing one.

### 6. Measure coverage

`CLAUDE.md` specifies 70% branch and 80% line coverage, and nothing currently
measures it. `coverlet.collector` is already referenced.

```bash
dotnet test --collect:"XPlat Code Coverage"
```

Look at where coverage is low, and decide whether it matters. Low coverage on
domain rules is a real gap; low coverage on generated migrations is not. Coverage
is a diagnostic, not a target — optimise the number and people write worthless
tests to hit it.

## Verify

```bash
dotnet test                              # backend, expect all green
cd src/frontend && npm run test          # frontend, expect 267
```

Then push the branch and confirm CI agrees:

```bash
gh pr create --fill
gh pr checks --watch
```

## Questions

1. What is the difference between a stub and a mock, and why does it matter?
2. `ApiFactory` replaces `IPaymentService` but keeps EF Core, auth and CSRF real.
   What is the principle behind that line, and what would go wrong if it faked
   the database too?
3. Why does `MsSqlBuilder` pin `2022-latest` instead of using `latest`?
4. What does `[Collection("api")]` do, and what is the cost of forgetting it?
5. Your integration tests pass locally and fail in CI. Name three likely causes.
6. When is a hand-written fake better than a mocking library, and when is it worse?

## Next

Phase 5, containerizing the application: why the Dockerfile that CI and
production use is a different concern from the Compose file that runs your local
database.
