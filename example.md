# Example Mermaid Diagrams

This file contains several Mermaid diagrams that can be visualized using the Mermaid to React Flow converter.

## Simple Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Process Flow with Styling

```mermaid
flowchart LR
    A[Input Data] --> B[Process Data]
    B --> C{Valid?}
    C -->|Yes| D[Store in Database]
    C -->|No| E[Log Error]
    E --> F[Send Alert]
    D --> G[Generate Report]
    F --> G
    G --> H[Output Result]
```

## Complex System Architecture

```mermaid
graph TB
    subgraph Frontend
        UI[User Interface]
        RT[React Components]
        RX[Redux Store]
    end
    
    subgraph Backend
        API[REST API]
        AUTH[Auth Service]
        DB[(Database)]
    end
    
    subgraph External
        CACHE[Redis Cache]
        QUEUE[Message Queue]
    end
    
    UI --> RT
    RT --> RX
    RX --> API
    API --> AUTH
    API --> DB
    API --> CACHE
    AUTH --> DB
    API --> QUEUE
```

## Decision Tree

```mermaid
graph TD
    START[Start Analysis] --> Q1{Data Available?}
    Q1 -->|Yes| Q2{Data Quality OK?}
    Q1 -->|No| END1[Request Data]
    Q2 -->|Yes| PROCESS[Process Data]
    Q2 -->|No| CLEAN[Clean Data]
    CLEAN --> PROCESS
    PROCESS --> Q3{Results Valid?}
    Q3 -->|Yes| REPORT[Generate Report]
    Q3 -->|No| REVIEW[Manual Review]
    REVIEW --> ADJUST[Adjust Parameters]
    ADJUST --> PROCESS
    REPORT --> END2[Complete]
```

## Workflow with Multiple Paths

```mermaid
flowchart TD
    A[User Request] --> B{Request Type}
    B -->|Create| C[Validate Input]
    B -->|Update| D[Check Permissions]
    B -->|Delete| E[Confirm Action]
    B -->|Read| F[Fetch Data]
    
    C --> G[Save to DB]
    D --> H{Has Permission?}
    H -->|Yes| I[Update Record]
    H -->|No| J[Access Denied]
    E --> K{Confirmed?}
    K -->|Yes| L[Delete Record]
    K -->|No| M[Cancel]
    F --> N[Return Data]
    
    G --> O[Success Response]
    I --> O
    L --> O
    N --> O
    J --> P[Error Response]
    M --> P
```

## C4 Context Diagram

```mermaid
C4Context
    title System Context diagram for Internet Banking System

    Enterprise_Boundary(b0, "Big Bank plc") {
        Person(customerA, "Banking Customer A", "A customer of the bank with personal accounts")

        System(SystemAA, "Internet Banking System", "Allows customers to view information about their bank accounts")
    }

    Person_Ext(customerC, "Banking Customer C", "A customer of another bank")

    System_Ext(SystemE, "E-mail System", "The internal Microsoft Exchange e-mail system")
    System_Ext(SystemC, "Mainframe Banking System", "Stores all of the core banking information")

    Rel(customerA, SystemAA, "Views account balances and makes payments using")
    Rel(SystemAA, SystemE, "Sends e-mail using", "SMTP")
    Rel(SystemAA, SystemC, "Gets account information from", "SOAP")
    Rel(customerC, SystemAA, "Uses", "HTTPS")
    Rel(SystemE, customerA, "Sends e-mails to")
```

## C4 Container Diagram Example

```mermaid
C4Context
    title Container diagram for Internet Banking System

    System_Boundary(s0, "Internet Banking System") {
        Container(webApp, "Web Application", "Java and Spring", "Delivers content")
        Container(apiApp, "API Application", "Java and Spring", "JSON/HTTPS API")
        ContainerDb(db, "Database", "Oracle", "Stores user data")
        ContainerQueue(mq, "Message Queue", "RabbitMQ", "Handles async tasks")
    }

    Person(customer, "Customer", "A bank customer")
    System_Ext(mainframe, "Mainframe", "Core banking system")

    Rel(customer, webApp, "Uses", "HTTPS")
    Rel(webApp, apiApp, "Makes API calls", "JSON/HTTPS")
    Rel(apiApp, db, "Reads/Writes", "JDBC")
    Rel(apiApp, mq, "Sends messages", "AMQP")
    Rel(apiApp, mainframe, "Gets data from", "SOAP/XML")
```