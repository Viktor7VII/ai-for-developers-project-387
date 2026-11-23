# Single image: the backend serves the API and the built frontend on the port from $PORT.

FROM node:26-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app
# The Maven build generates server API interfaces from the committed OpenAPI spec (ADR-0003).
COPY contracts/openapi/openapi.yaml contracts/openapi/openapi.yaml
COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/pom.xml backend/
RUN chmod +x backend/mvnw && cd backend && ./mvnw -q -B dependency:go-offline
COPY backend/src backend/src
COPY --from=frontend /app/frontend/dist backend/src/main/resources/static
RUN cd backend && ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 app && mkdir /app/data && chown app /app/data
COPY --from=backend /app/backend/target/backend-*.jar app.jar
USER app
# H2 database file lives in /app/data; mount a persistent disk there to keep data across restarts.
ENV PORT=8080 \
    CALENDAR_DB_URL=jdbc:h2:file:/app/data/calendar \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
