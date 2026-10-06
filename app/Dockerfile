# =====================================================================
# Estágio 1: Build da aplicação com Maven e JDK 21
# =====================================================================
FROM maven:3.9.8-eclipse-temurin-21-alpine AS builder
WORKDIR /build

COPY pom.xml .
# Baixar dependências para cache de camadas do Docker
RUN mvn dependency:go-offline -B || true

COPY src ./src
RUN mvn clean package -DskipTests

# =====================================================================
# Estágio 2: Imagem final leve com JRE 21 Alpine (~180 MB)
# =====================================================================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Usuário sem privilégios de root para segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080

# Parâmetros da JVM contidos para execução eficiente no Codespaces Free Tier (2 vCPUs / 8 GB RAM)
ENV JAVA_OPTS="-Xms128m -Xmx384m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
