namespace Api.DataSeeding;

/// <summary>
/// Constants for the bulk data seeder: file bytes, course topics, and config.
/// </summary>
public static class BulkSeedConstants
{
    public const string EmailDomain = "@bulk.seed.km";
    public const string DefaultPassword = "BulkSeed@2026!";
    public const int CreatorCount = 20;
    public const int BuyerCount = 100;
    public const int CoursesPerCreator = 10;
    public const int TotalCourses = CreatorCount * CoursesPerCreator; // 200
    public const int MinLessonsPerCourse = 3;
    public const int MaxLessonsPerCourse = 8;
    public const int MinOrdersPerBuyer = 40;
    public const int MaxOrdersPerBuyer = 60;
    public const int SubscriptionCount = 100;
    public const int BatchSize = 500;
    public const int FileUploadConcurrency = 20;
    public const int BogusRandomSeed = 82364;

    // ── Minimal valid 1x1 white PNG (68 bytes) ────────────────────────
    public static readonly byte[] MinimalPng =
    {
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
        0x44, 0xAE, 0x42, 0x60, 0x82,
    };

    // ── Minimal valid PDF (~67 bytes) ─────────────────────────────────
    public static readonly byte[] MinimalPdf = System.Text.Encoding.ASCII.GetBytes(
        "%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/MediaBox[0 0 1 1]/Parent 2 0 R>>endobj\n" +
        "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n" +
        "0000000058 00000 n \n0000000115 00000 n \n" +
        "trailer<</Size 4/Root 1 0 R>>\nstartxref\n183\n%%EOF");

    // ── Minimal valid MP4 (ftyp + empty moov) ─────────────────────────
    public static readonly byte[] MinimalMp4 = BuildMinimalMp4();

    private static byte[] BuildMinimalMp4()
    {
        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);

        // ftyp box (file type)
        WriteBox(bw, "ftyp", w =>
        {
            w.Write(System.Text.Encoding.ASCII.GetBytes("isom")); // major brand
            w.Write(BEInt32(0)); // minor version
            w.Write(System.Text.Encoding.ASCII.GetBytes("isom")); // compatible brand
        });

        // moov box with minimal mvhd + trak
        WriteBox(bw, "moov", w =>
        {
            // mvhd (movie header)
            WriteFullBox(w, "mvhd", 0, 0, fw =>
            {
                fw.Write(BEInt32(0)); // creation time
                fw.Write(BEInt32(0)); // modification time
                fw.Write(BEInt32(1000)); // timescale
                fw.Write(BEInt32(0)); // duration
                fw.Write(BEInt32(0x00010000)); // rate 1.0
                fw.Write(BEInt16(0x0100)); // volume 1.0
                fw.Write(new byte[10]); // reserved
                // identity matrix (9 × int32)
                fw.Write(BEInt32(0x00010000)); fw.Write(BEInt32(0)); fw.Write(BEInt32(0));
                fw.Write(BEInt32(0)); fw.Write(BEInt32(0x00010000)); fw.Write(BEInt32(0));
                fw.Write(BEInt32(0)); fw.Write(BEInt32(0)); fw.Write(BEInt32(0x40000000));
                fw.Write(new byte[24]); // pre-defined
                fw.Write(BEInt32(2)); // next track ID
            });

            // trak box (empty track)
            WriteBox(w, "trak", tw =>
            {
                WriteFullBox(tw, "tkhd", 0, 3, thw => // flags = 3 (enabled+in_movie)
                {
                    thw.Write(BEInt32(0)); // creation time
                    thw.Write(BEInt32(0)); // modification time
                    thw.Write(BEInt32(1)); // track ID
                    thw.Write(BEInt32(0)); // reserved
                    thw.Write(BEInt32(0)); // duration
                    thw.Write(new byte[8]); // reserved
                    thw.Write(BEInt16(0)); // layer
                    thw.Write(BEInt16(0)); // alternate group
                    thw.Write(BEInt16(0)); // volume
                    thw.Write(new byte[2]); // reserved
                    // identity matrix
                    thw.Write(BEInt32(0x00010000)); thw.Write(BEInt32(0)); thw.Write(BEInt32(0));
                    thw.Write(BEInt32(0)); thw.Write(BEInt32(0x00010000)); thw.Write(BEInt32(0));
                    thw.Write(BEInt32(0)); thw.Write(BEInt32(0)); thw.Write(BEInt32(0x40000000));
                    thw.Write(BEInt32(0)); // width
                    thw.Write(BEInt32(0)); // height
                });

                // mdia box (media)
                WriteBox(tw, "mdia", mw =>
                {
                    WriteFullBox(mw, "mdhd", 0, 0, mhw =>
                    {
                        mhw.Write(BEInt32(0)); mhw.Write(BEInt32(0));
                        mhw.Write(BEInt32(1000)); mhw.Write(BEInt32(0));
                        mhw.Write(BEInt16(0x55C4)); // language "und"
                        mhw.Write(BEInt16(0)); // pre-defined
                    });
                    WriteFullBox(mw, "hdlr", 0, 0, hw =>
                    {
                        hw.Write(BEInt32(0)); // pre-defined
                        hw.Write(System.Text.Encoding.ASCII.GetBytes("vide"));
                        hw.Write(new byte[12]); // reserved
                        hw.Write((byte)0); // name (null-terminated)
                    });
                    WriteBox(mw, "minf", _ => { }); // empty minf
                });
            });
        });

        return ms.ToArray();
    }

    private static void WriteBox(BinaryWriter bw, string type, Action<BinaryWriter> writePayload)
    {
        var start = bw.BaseStream.Position;
        bw.Write(BEInt32(0)); // placeholder size
        bw.Write(System.Text.Encoding.ASCII.GetBytes(type));
        writePayload(bw);
        var end = bw.BaseStream.Position;
        bw.BaseStream.Position = start;
        bw.Write(BEInt32((int)(end - start)));
        bw.BaseStream.Position = end;
    }

    private static void WriteFullBox(BinaryWriter bw, string type, byte version, uint flags,
        Action<BinaryWriter> writePayload)
    {
        WriteBox(bw, type, w =>
        {
            w.Write(new[] { version, (byte)((flags >> 16) & 0xFF), (byte)((flags >> 8) & 0xFF), (byte)(flags & 0xFF) });
            writePayload(w);
        });
    }

    private static byte[] BEInt32(int v) =>
        new[] { (byte)((v >> 24) & 0xFF), (byte)((v >> 16) & 0xFF), (byte)((v >> 8) & 0xFF), (byte)(v & 0xFF) };

    private static byte[] BEInt16(int v) =>
        new[] { (byte)((v >> 8) & 0xFF), (byte)(v & 0xFF) };

    // ── Course topics (20 categories) ─────────────────────────────────
    public static readonly CourseTopicGroup[] Topics =
    {
        new("Web Development", new[] { "web", "frontend", "html" }, new[]
        {
            ("Building Modern SPAs with React", "Master React 19 patterns, hooks, and server-side rendering for production web applications."),
            ("Advanced CSS Techniques", "Deep dive into Grid, Flexbox, animations, and responsive design patterns used by top companies."),
            ("Full-Stack TypeScript", "Build end-to-end applications using TypeScript on both client and server with Node.js."),
            ("Vue.js Enterprise Patterns", "Learn scalable Vue 3 architecture with Composition API, Pinia, and testing strategies."),
            ("Angular Deep Dive", "Master Angular with RxJS, NgRx, and enterprise-grade component architecture."),
            ("Next.js Production Guide", "Deploy production-ready Next.js apps with ISR, middleware, and edge functions."),
            ("Svelte and SvelteKit Mastery", "Build blazing-fast web apps with Svelte's compiler-first approach."),
            ("Web Performance Optimization", "Achieve perfect Lighthouse scores with lazy loading, code splitting, and CDN strategies."),
            ("Progressive Web Apps", "Transform web applications into installable, offline-capable PWAs."),
            ("Astro for Content Sites", "Build content-heavy sites with Astro's island architecture and zero-JS defaults."),
        }),
        new("Data Science", new[] { "data", "analytics", "statistics" }, new[]
        {
            ("Python for Data Analysis", "Use pandas, NumPy, and matplotlib to explore, clean, and visualize real-world datasets."),
            ("Statistical Thinking for Engineers", "Apply hypothesis testing, regression, and Bayesian methods to engineering problems."),
            ("Data Visualization Masterclass", "Create compelling charts and dashboards using D3.js, Plotly, and Tableau."),
            ("R Programming for Researchers", "Leverage R's tidyverse for academic research, reproducible reports, and publication-ready plots."),
            ("SQL for Data Scientists", "Write advanced SQL queries, window functions, and CTEs to extract insights from large databases."),
            ("Time Series Forecasting", "Build ARIMA, Prophet, and LSTM models for stock, weather, and demand forecasting."),
            ("A/B Testing and Experimentation", "Design rigorous experiments, calculate sample sizes, and interpret results correctly."),
            ("Natural Language Processing Essentials", "Process text data with tokenization, sentiment analysis, and topic modeling using spaCy and NLTK."),
            ("Geospatial Data Analysis", "Analyze and visualize geographic data using GeoPandas, Folium, and PostGIS."),
            ("Data Cleaning and Wrangling", "Handle missing values, outliers, and messy data formats in real-world datasets."),
        }),
        new("Cloud and DevOps", new[] { "cloud", "devops", "aws" }, new[]
        {
            ("AWS Solutions Architect Prep", "Prepare for the AWS SAA-C03 exam with hands-on labs covering VPC, EC2, S3, and Lambda."),
            ("Docker and Kubernetes in Practice", "Containerize applications and orchestrate deployments with Docker Compose and K8s manifests."),
            ("Terraform Infrastructure as Code", "Provision cloud infrastructure declaratively with Terraform modules, state management, and CI/CD."),
            ("CI/CD Pipeline Design", "Build robust pipelines with GitHub Actions, GitLab CI, and ArgoCD for continuous delivery."),
            ("Linux System Administration", "Master shell scripting, systemd, networking, and security hardening on Linux servers."),
            ("Azure Cloud Fundamentals", "Deploy and manage resources on Azure with ARM templates, App Service, and Azure Functions."),
            ("Monitoring and Observability", "Implement logging, metrics, and tracing with Prometheus, Grafana, and OpenTelemetry."),
            ("GitOps with Flux and ArgoCD", "Manage Kubernetes clusters using Git as the single source of truth."),
            ("Cloud Cost Optimization", "Reduce cloud spend with reserved instances, spot fleets, and right-sizing strategies."),
            ("Service Mesh with Istio", "Implement traffic management, security, and observability in microservices with Istio."),
        }),
        new("Mobile Development", new[] { "mobile", "ios", "android" }, new[]
        {
            ("React Native Cross-Platform Apps", "Build iOS and Android apps from a single codebase using React Native and Expo."),
            ("SwiftUI for iOS Developers", "Create beautiful, native iOS interfaces with SwiftUI's declarative syntax."),
            ("Kotlin Android Development", "Build modern Android apps using Kotlin, Jetpack Compose, and MVVM architecture."),
            ("Flutter Complete Guide", "Master Dart and Flutter to build cross-platform mobile apps with Material Design."),
            ("Mobile App Testing Strategies", "Implement unit, integration, and E2E tests for mobile apps using Detox and XCTest."),
            ("Mobile CI/CD with Fastlane", "Automate builds, screenshots, and App Store deployments with Fastlane."),
            ("Offline-First Mobile Architecture", "Design apps that work without connectivity using SQLite, Realm, and sync strategies."),
            ("Push Notifications and Messaging", "Implement FCM, APNs, and in-app messaging for user engagement and retention."),
            ("Mobile App Security", "Protect mobile apps with certificate pinning, biometric auth, and secure storage."),
            ("Wearable App Development", "Build apps for Apple Watch and Wear OS with health sensors and complications."),
        }),
        new("Machine Learning and AI", new[] { "ml", "ai", "deep-learning" }, new[]
        {
            ("Machine Learning Foundations", "Understand supervised and unsupervised learning, bias-variance tradeoff, and model evaluation."),
            ("Deep Learning with PyTorch", "Build CNNs, RNNs, and transformers from scratch using PyTorch and torchvision."),
            ("TensorFlow Production Pipeline", "Deploy ML models with TensorFlow Serving, TFX, and Google Cloud AI Platform."),
            ("Reinforcement Learning", "Train agents to play games and solve control problems using Q-learning and policy gradients."),
            ("Computer Vision Applications", "Detect objects, segment images, and build face recognition systems with OpenCV and YOLO."),
            ("Generative AI and LLMs", "Fine-tune large language models and build RAG applications with LangChain and vector databases."),
            ("MLOps and Model Management", "Version models, track experiments, and automate retraining with MLflow and DVC."),
            ("Feature Engineering for ML", "Transform raw data into powerful features using encoding, scaling, and domain knowledge."),
            ("Anomaly Detection Systems", "Build real-time anomaly detection for fraud, intrusion, and manufacturing defects."),
            ("AutoML and Hyperparameter Tuning", "Automate model selection and tuning with Optuna, Ray Tune, and AutoKeras."),
        }),
        new("Cybersecurity", new[] { "security", "infosec", "hacking" }, new[]
        {
            ("Ethical Hacking Fundamentals", "Learn penetration testing methodology, reconnaissance, and vulnerability assessment."),
            ("Web Application Security", "Prevent OWASP Top 10 vulnerabilities including XSS, SQLi, CSRF, and SSRF."),
            ("Network Security and Firewalls", "Configure firewalls, IDS/IPS, and VPNs to protect enterprise networks."),
            ("Incident Response Planning", "Develop IR playbooks, conduct forensic analysis, and manage security breaches."),
            ("Cloud Security Architecture", "Secure cloud workloads with IAM policies, encryption, and compliance frameworks."),
            ("Cryptography Essentials", "Understand symmetric, asymmetric encryption, hashing, and PKI for secure communications."),
            ("Secure Code Review", "Identify security flaws in source code using SAST tools and manual review techniques."),
            ("SOC Analyst Bootcamp", "Monitor security events, analyze alerts, and respond to threats in a Security Operations Center."),
            ("Mobile Security Testing", "Test Android and iOS apps for insecure storage, broken crypto, and API vulnerabilities."),
            ("Zero Trust Architecture", "Implement zero trust principles with micro-segmentation, MFA, and continuous verification."),
        }),
        new("Databases", new[] { "database", "sql", "nosql" }, new[]
        {
            ("PostgreSQL Performance Mastery", "Optimize queries with EXPLAIN ANALYZE, indexing strategies, and connection pooling."),
            ("MongoDB for Developers", "Design schemas, write aggregation pipelines, and scale with sharding and replica sets."),
            ("Redis Caching Strategies", "Implement caching, pub/sub, and rate limiting with Redis data structures."),
            ("Database Design Patterns", "Apply normalization, denormalization, and CQRS patterns for scalable schema design."),
            ("Elasticsearch Full-Text Search", "Build search engines with Elasticsearch queries, analyzers, and relevance tuning."),
            ("SQL Query Optimization", "Write efficient SQL with proper joins, indexes, and execution plan analysis."),
            ("Graph Databases with Neo4j", "Model and query connected data using Cypher and graph algorithms."),
            ("Database Migration Strategies", "Plan zero-downtime schema migrations, data backfills, and version control for databases."),
            ("DynamoDB Serverless Patterns", "Design single-table schemas and implement DAX caching for serverless applications."),
            ("TimescaleDB for IoT", "Store and query time-series data at scale with hypertables and continuous aggregates."),
        }),
        new("System Design", new[] { "architecture", "distributed-systems", "scalability" }, new[]
        {
            ("System Design Interview Prep", "Master the framework for designing scalable systems: URL shorteners, chat apps, and news feeds."),
            ("Microservices Architecture", "Decompose monoliths into microservices with proper boundaries, communication, and data ownership."),
            ("Event-Driven Architecture", "Build reactive systems with Apache Kafka, RabbitMQ, and event sourcing patterns."),
            ("API Gateway Patterns", "Implement rate limiting, authentication, and request routing with Kong and AWS API Gateway."),
            ("Distributed Caching", "Design caching layers with Redis Cluster, Memcached, and cache invalidation strategies."),
            ("Load Balancing and CDN", "Configure Nginx, HAProxy, and CloudFront for global traffic distribution."),
            ("Database Sharding Strategies", "Horizontally partition data across multiple database instances for massive scale."),
            ("Resilience Engineering", "Build fault-tolerant systems with circuit breakers, bulkheads, and chaos engineering."),
            ("Real-Time Data Pipelines", "Stream data with Apache Kafka, Flink, and Spark Streaming for real-time analytics."),
            ("Domain-Driven Design", "Model complex business domains with bounded contexts, aggregates, and domain events."),
        }),
        new("Programming Languages", new[] { "programming", "languages", "fundamentals" }, new[]
        {
            ("Rust Systems Programming", "Write safe, concurrent programs with Rust's ownership model, lifetimes, and async/await."),
            ("Go for Backend Developers", "Build high-performance APIs and CLIs with Go's goroutines, channels, and standard library."),
            ("Advanced Python Patterns", "Master decorators, metaclasses, generators, and async programming in Python."),
            ("Modern C++ (C++20/23)", "Leverage concepts, ranges, coroutines, and modules in contemporary C++ development."),
            ("Functional Programming in Scala", "Apply monads, type classes, and effect systems for robust functional programs."),
            ("Java 21 Virtual Threads", "Build scalable concurrent applications with Project Loom's virtual threads."),
            ("Elixir and Phoenix LiveView", "Create real-time web applications with Elixir's OTP concurrency model."),
            ("Zig for Performance", "Write low-level, high-performance code with Zig's comptime and manual memory management."),
            ("TypeScript Type System Mastery", "Leverage conditional types, mapped types, template literals, and infer for type-safe APIs."),
            ("Clojure Data-Oriented Design", "Build robust systems with immutable data, REPL-driven development, and spec validation."),
        }),
        new("Game Development", new[] { "gamedev", "unity", "unreal" }, new[]
        {
            ("Unity Game Programming", "Build 2D and 3D games with Unity, C# scripting, physics, and the new Input System."),
            ("Unreal Engine Blueprint Mastery", "Create AAA-quality games using Blueprints, materials, and Unreal's animation system."),
            ("Godot Game Development", "Build cross-platform games with Godot 4's GDScript and scene system."),
            ("Game Physics and Math", "Implement collision detection, rigid body dynamics, and spatial partitioning algorithms."),
            ("Multiplayer Game Networking", "Build real-time multiplayer games with state synchronization and lag compensation."),
            ("Game AI Programming", "Implement pathfinding, behavior trees, and state machines for intelligent NPCs."),
            ("Pixel Art and Game Design", "Create sprite animations, tilesets, and game UX with professional pixel art techniques."),
            ("VR Development with Unity", "Build immersive VR experiences with hand tracking, locomotion, and spatial audio."),
            ("Procedural Content Generation", "Generate infinite worlds, dungeons, and terrain using noise functions and L-systems."),
            ("Game Monetization Strategies", "Implement ethical monetization with battle passes, cosmetics, and A/B tested storefronts."),
        }),
        new("Blockchain", new[] { "blockchain", "web3", "crypto" }, new[]
        {
            ("Solidity Smart Contract Development", "Write, test, and deploy Ethereum smart contracts with Hardhat and OpenZeppelin."),
            ("DeFi Protocol Engineering", "Build AMMs, lending protocols, and yield aggregators on EVM-compatible chains."),
            ("NFT Marketplace Architecture", "Create NFT minting, trading, and royalty systems with ERC-721 and ERC-1155."),
            ("Blockchain Security Auditing", "Find vulnerabilities in smart contracts: reentrancy, flash loans, and oracle manipulation."),
            ("Layer 2 Scaling Solutions", "Implement rollups, state channels, and sidechains for Ethereum scalability."),
            ("Rust for Solana Development", "Build high-performance programs on Solana using Anchor framework and Rust."),
            ("Cross-Chain Bridge Design", "Design and implement secure cross-chain communication protocols."),
            ("Tokenomics and Game Theory", "Design sustainable token economies with staking, governance, and incentive alignment."),
            ("Zero Knowledge Proofs", "Implement zk-SNARKs and zk-STARKs for privacy-preserving blockchain applications."),
            ("Web3 Frontend Integration", "Connect dApps with wallets using ethers.js, wagmi, and RainbowKit."),
        }),
        new("UI/UX Design", new[] { "design", "ux", "ui" }, new[]
        {
            ("Design Systems from Scratch", "Build scalable design systems with tokens, components, and documentation using Figma."),
            ("UX Research Methods", "Conduct user interviews, usability tests, and surveys to inform product decisions."),
            ("Responsive Design Patterns", "Create layouts that work beautifully across mobile, tablet, and desktop breakpoints."),
            ("Accessibility for Developers", "Build WCAG 2.1 AA compliant interfaces with screen reader support and keyboard navigation."),
            ("Motion Design for UI", "Add meaningful animations with Framer Motion, CSS transitions, and Lottie."),
            ("Information Architecture", "Organize content with card sorting, tree testing, and navigation design patterns."),
            ("Color Theory for Digital Products", "Choose effective color palettes, ensure contrast ratios, and design for color blindness."),
            ("Prototyping with Figma", "Create interactive prototypes with auto layout, components, and smart animate."),
            ("Design Thinking Workshop", "Facilitate ideation sessions, create empathy maps, and run design sprints."),
            ("Dashboard and Data UI Design", "Design complex data-dense interfaces with tables, charts, and filtering patterns."),
        }),
        new("QA and Testing", new[] { "testing", "qa", "automation" }, new[]
        {
            ("Test Automation with Playwright", "Write reliable E2E tests with auto-waiting, visual comparisons, and parallel execution."),
            ("Unit Testing Best Practices", "Write maintainable tests with proper mocking, assertions, and test organization patterns."),
            ("API Testing with Postman", "Design API test collections, chain requests, and integrate with CI/CD pipelines."),
            ("Performance Testing with k6", "Load test APIs and websites, identify bottlenecks, and establish performance baselines."),
            ("Test-Driven Development", "Practice TDD with red-green-refactor cycles for cleaner, more reliable code."),
            ("Visual Regression Testing", "Catch UI bugs automatically with screenshot comparison tools like Percy and Chromatic."),
            ("Contract Testing with Pact", "Verify API contracts between microservices without integration test environments."),
            ("Security Testing Essentials", "Run DAST and SAST scans, fuzz inputs, and test authentication/authorization flows."),
            ("Mobile Testing with Appium", "Automate mobile app testing across iOS and Android simulators and real devices."),
            ("Chaos Engineering Practices", "Inject failures in production to build confidence in system resilience."),
        }),
        new("Networking", new[] { "networking", "protocols", "tcp" }, new[]
        {
            ("TCP/IP Networking Fundamentals", "Understand the OSI model, IP addressing, subnetting, and packet analysis with Wireshark."),
            ("HTTP/2 and HTTP/3 Deep Dive", "Master modern HTTP protocols, QUIC, and their impact on web performance."),
            ("DNS and Domain Management", "Configure DNS records, DNSSEC, and troubleshoot resolution issues."),
            ("Network Troubleshooting", "Diagnose connectivity issues with ping, traceroute, netstat, and packet captures."),
            ("Software-Defined Networking", "Program network infrastructure with OpenFlow, P4, and SDN controllers."),
            ("gRPC and Protocol Buffers", "Build efficient microservice communication with gRPC streaming and protobuf schemas."),
            ("WebSocket Real-Time Apps", "Implement bidirectional communication for chat, gaming, and live dashboards."),
            ("BGP and Internet Routing", "Understand autonomous systems, peering, and BGP route optimization."),
            ("Network Automation with Python", "Automate network configuration with Netmiko, NAPALM, and Ansible network modules."),
            ("VPN and Tunneling Protocols", "Implement WireGuard, IPsec, and SSH tunneling for secure remote access."),
        }),
        new("Embedded Systems", new[] { "embedded", "iot", "hardware" }, new[]
        {
            ("Arduino for Beginners", "Build IoT projects with Arduino boards, sensors, and serial communication."),
            ("Raspberry Pi System Projects", "Create home automation, media centers, and network tools with Raspberry Pi."),
            ("RTOS Programming", "Develop real-time embedded applications with FreeRTOS task scheduling and synchronization."),
            ("Embedded C Best Practices", "Write efficient, portable embedded C code with proper memory management and interrupts."),
            ("IoT Protocol Stack", "Implement MQTT, CoAP, and LoRaWAN for constrained IoT device communication."),
            ("PCB Design Fundamentals", "Design printed circuit boards with KiCad, from schematic to manufacturing files."),
            ("Embedded Linux Development", "Cross-compile, build root filesystems, and develop device drivers for embedded Linux."),
            ("Sensor Integration and Signal Processing", "Interface with ADCs, IMUs, and environmental sensors with digital filtering techniques."),
            ("Low-Power Design Techniques", "Optimize battery life with sleep modes, duty cycling, and power budgeting."),
            ("Firmware Over-The-Air Updates", "Implement secure OTA update mechanisms for deployed IoT devices."),
        }),
        new("API Design", new[] { "api", "rest", "graphql" }, new[]
        {
            ("RESTful API Design Principles", "Design clean, consistent REST APIs with proper resource modeling and HATEOAS."),
            ("GraphQL API Development", "Build flexible APIs with GraphQL schemas, resolvers, and DataLoader for N+1 prevention."),
            ("API Versioning Strategies", "Manage breaking changes with URL, header, and content negotiation versioning."),
            ("OpenAPI and API Documentation", "Generate and maintain API docs with Swagger/OpenAPI specifications."),
            ("API Rate Limiting and Throttling", "Implement token buckets, sliding windows, and distributed rate limiting."),
            ("Webhook Design Patterns", "Build reliable webhook delivery with retries, signatures, and idempotency keys."),
            ("API Authentication Methods", "Compare OAuth 2.0, API keys, JWT, and mTLS for different use cases."),
            ("gRPC vs REST Performance", "Benchmark and choose between gRPC and REST for microservice communication."),
            ("API Gateway Implementation", "Build custom API gateways with request transformation, caching, and circuit breaking."),
            ("Hypermedia API Design", "Implement discoverable APIs with HAL, JSON:API, and HATEOAS link relations."),
        }),
        new("Data Engineering", new[] { "data-engineering", "etl", "pipeline" }, new[]
        {
            ("Apache Spark Essentials", "Process big data with Spark SQL, DataFrames, and structured streaming."),
            ("Data Warehouse Design", "Model star and snowflake schemas for analytical workloads with dbt and BigQuery."),
            ("ETL Pipeline with Airflow", "Orchestrate data workflows with Apache Airflow DAGs, operators, and sensors."),
            ("Streaming with Apache Kafka", "Build real-time data pipelines with Kafka producers, consumers, and Kafka Streams."),
            ("Data Lake Architecture", "Design scalable data lakes on S3 with Delta Lake, Iceberg, and partition strategies."),
            ("Data Quality and Governance", "Implement data validation, lineage tracking, and cataloging with Great Expectations."),
            ("dbt for Analytics Engineering", "Transform warehouse data with dbt models, tests, and documentation."),
            ("Change Data Capture", "Stream database changes with Debezium, CDC pipelines, and event-driven architectures."),
            ("Batch Processing with Flink", "Process bounded and unbounded datasets with Apache Flink's DataStream API."),
            ("Data Mesh Principles", "Decentralize data ownership with domain-oriented, self-serve data infrastructure."),
        }),
        new("Project Management", new[] { "management", "agile", "scrum" }, new[]
        {
            ("Agile Project Management", "Lead Scrum ceremonies, manage backlogs, and deliver software iteratively."),
            ("Technical Leadership Skills", "Mentor engineers, run architecture reviews, and make technical decisions."),
            ("Jira and Confluence Mastery", "Configure Jira workflows, boards, and dashboards for engineering teams."),
            ("Engineering Metrics and OKRs", "Track velocity, cycle time, and DORA metrics to improve team performance."),
            ("Remote Team Management", "Build culture, facilitate async communication, and maintain productivity in distributed teams."),
            ("Stakeholder Communication", "Present technical concepts to non-technical audiences with clarity and confidence."),
            ("Risk Management in Software", "Identify, assess, and mitigate project risks with practical frameworks."),
            ("Estimation and Planning", "Use story points, t-shirt sizing, and Monte Carlo simulations for realistic estimates."),
            ("DevOps Culture and Practices", "Foster collaboration between development and operations with shared ownership."),
            ("Post-Mortem and Blameless Culture", "Conduct effective incident reviews and build learning organizations."),
        }),
        new("Technical Writing", new[] { "writing", "documentation", "docs" }, new[]
        {
            ("Writing Effective Documentation", "Create clear, user-focused documentation with templates, style guides, and versioning."),
            ("API Documentation Best Practices", "Write developer-friendly API docs with examples, error codes, and quickstart guides."),
            ("Technical Blog Writing", "Write engaging technical blog posts that explain complex concepts clearly."),
            ("Documentation as Code", "Manage docs with Git, Markdown, MkDocs, and automated publishing pipelines."),
            ("README-Driven Development", "Write compelling READMEs that help developers understand and adopt your projects."),
            ("Diagramming for Engineers", "Create architecture diagrams with Mermaid, PlantUML, and C4 model notation."),
            ("Writing RFCs and Design Docs", "Propose technical changes with structured RFC documents and design reviews."),
            ("Knowledge Base Management", "Organize team knowledge with wikis, runbooks, and searchable documentation systems."),
            ("Developer Experience Writing", "Craft onboarding guides, tutorials, and error messages that reduce developer friction."),
            ("Localization and Translation", "Prepare documentation for international audiences with i18n-friendly writing practices."),
        }),
        new("Open Source", new[] { "open-source", "community", "github" }, new[]
        {
            ("Contributing to Open Source", "Find projects, submit PRs, and build your reputation in the open source community."),
            ("Maintaining Open Source Projects", "Manage issues, review PRs, and build sustainable open source communities."),
            ("Open Source Licensing Guide", "Choose between MIT, Apache 2.0, GPL, and other licenses for your projects."),
            ("Building CLI Tools", "Create professional command-line tools with argument parsing, help text, and package publishing."),
            ("GitHub Actions for OSS", "Automate CI, releases, and community management with GitHub Actions workflows."),
            ("Package Publishing", "Publish and maintain packages on npm, PyPI, crates.io, and NuGet with semantic versioning."),
            ("Developer Relations and Advocacy", "Build developer communities, write tutorials, and speak at conferences."),
            ("Code Review Best Practices", "Give constructive feedback, catch bugs, and maintain code quality through reviews."),
            ("Monorepo Management", "Manage multi-package repositories with Nx, Turborepo, and Lerna."),
            ("Open Source Security", "Handle vulnerability disclosures, implement security policies, and audit dependencies."),
        }),
    };

    public sealed record CourseTopicGroup(string Category, string[] Tags, (string Title, string Description)[] Courses);

    // ── Review comment templates by rating ────────────────────────────
    public static readonly string[] PositiveComments =
    {
        "Excellent course! Highly recommended for anyone looking to level up.",
        "The instructor explains complex topics clearly. Worth every penny.",
        "Best course I've taken on this topic. Great structure and pacing.",
        "Very practical with real-world examples. Applied what I learned immediately.",
        "Comprehensive coverage. Loved the hands-on exercises.",
        "Outstanding quality. The code examples are clean and well-explained.",
        "This course changed how I approach the subject. Truly transformative.",
        "Clear, concise, and packed with value. Five stars without hesitation.",
    };

    public static readonly string[] NeutralComments =
    {
        "Good course overall. Some sections could use more depth.",
        "Solid content but the pacing was a bit uneven in places.",
        "Decent introduction to the topic. Could benefit from more exercises.",
        "Good foundation material. Advanced topics felt a bit rushed.",
        "Helpful course with good examples, though some are slightly outdated.",
        "Well-structured but I expected more coverage of recent developments.",
    };

    public static readonly string[] NegativeComments =
    {
        "The content was too basic for what was advertised.",
        "Some sections felt incomplete. Expected more for the price.",
        "Audio quality could be improved. Content was okay otherwise.",
        "Good information but the pace was too slow for experienced developers.",
    };
}
