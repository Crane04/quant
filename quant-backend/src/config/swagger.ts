import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Quant Backend API",
      version: "1.0.0",
      description:
        "API for Quant — a WhatsApp academic assistant (lecture summaries, assignment reminders, " +
        "PDFs, timetable access, CGPA tracking). Three callers hit this API: a student's own " +
        "session (web portal, ambassadors only), the WhatsApp bot process (shared service key), " +
        "and the admin dashboard (separate admin session).",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        studentSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "session token",
          description: "A student's own session token from POST /auth/login (ambassadors only).",
        },
        adminSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "session token",
          description: "An admin's session token from POST /auth/login (admin login).",
        },
        botServiceKey: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description:
            "Shared secret for the in-process WhatsApp bot logic (BOT_SERVICE_API_KEY). Pass the " +
            "student's phone in the query string or body to identify who it's acting for.",
        },
      },
      schemas: {
        SuccessMessage: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            details: {},
          },
        },
        Student: {
          type: "object",
          properties: {
            id: { type: "string" },
            fullName: { type: "string" },
            phone: { type: "string", example: "+2348012345678" },
            email: { type: "string", format: "email" },
            matricNumber: { type: "string" },
            university: { type: "string" },
            department: { type: "string" },
            level: { type: "string", example: "300" },
            isPhoneVerified: { type: "boolean" },
            isEmailVerified: { type: "boolean" },
            isAmbassador: { type: "boolean" },
            lastSeenAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Admin: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["super_admin", "admin"] },
            isActive: { type: "boolean" },
            lastLoginAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Course: {
          type: "object",
          properties: {
            _id: { type: "string" },
            code: { type: "string", example: "MEE 305" },
            title: { type: "string" },
            university: { type: "string" },
            department: { type: "string" },
            level: { type: "string" },
            creditUnits: { type: "integer" },
            session: { type: "string", example: "2024/2025" },
            semester: { type: "string", enum: ["first", "second"] },
          },
        },
        StudentCourse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { type: "string" },
            course: { $ref: "#/components/schemas/Course" },
            session: { type: "string" },
            semester: { type: "string", enum: ["first", "second"] },
          },
        },
        TimetableSlot: {
          type: "object",
          properties: {
            _id: { type: "string" },
            course: { $ref: "#/components/schemas/Course" },
            dayOfWeek: {
              type: "string",
              enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            },
            startTime: { type: "string", example: "09:00" },
            endTime: { type: "string", example: "11:00" },
            venue: { type: "string" },
          },
        },
        Assignment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            course: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
            attachmentUrl: { type: "string" },
          },
        },
        AssignmentWithStatus: {
          allOf: [
            { $ref: "#/components/schemas/Assignment" },
            { type: "object", properties: { completed: { type: "boolean" } } },
          ],
        },
        LectureSummary: {
          type: "object",
          properties: {
            _id: { type: "string" },
            course: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            sourceDocument: { type: "string" },
          },
        },
        DocumentFile: {
          type: "object",
          properties: {
            _id: { type: "string" },
            course: { $ref: "#/components/schemas/Course" },
            title: { type: "string" },
            fileUrl: { type: "string" },
            fileType: { type: "string", example: "pdf" },
            sizeBytes: { type: "integer" },
            tags: { type: "array", items: { type: "string" } },
            downloadCount: { type: "integer" },
            uploadedByType: { type: "string", enum: ["Admin", "Student"] },
            uploadedBy: { type: "string" },
          },
        },
        GradeRecord: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { type: "string" },
            course: { $ref: "#/components/schemas/Course" },
            session: { type: "string" },
            semester: { type: "string", enum: ["first", "second"] },
            creditUnits: { type: "integer" },
            grade: { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
            gradePoint: { type: "number" },
          },
        },
        Cgpa: {
          type: "object",
          properties: {
            cgpa: { type: "number", example: 4.32 },
            totalCreditUnits: { type: "integer" },
            semesterBreakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  session: { type: "string" },
                  semester: { type: "string" },
                  gpa: { type: "number" },
                  totalUnits: { type: "integer" },
                },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing, invalid, or expired credentials",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        Forbidden: {
          description: "Authenticated, but not allowed to perform this action",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        NotFound: {
          description: "Resource not found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        BadRequest: {
          description: "Validation failed",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
