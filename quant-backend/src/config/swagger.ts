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
          description:
            "A student's own session token from POST /auth/student-login (ambassadors only).",
        },
        adminSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "session token",
          description:
            "An admin's session token from POST /auth/login (admin login).",
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
            faculty: { type: "string", nullable: true, example: "Engineering" },
            department: { type: "string" },
            level: { type: "string", example: "300" },
            accessStatus: {
              type: "string",
              enum: ["full", "waitlist_school", "waitlist_faculty"],
              description:
                "full = LASU Engineering (live). Otherwise the student is waitlisted until their school/faculty launches.",
            },
            isPhoneVerified: { type: "boolean" },
            isEmailVerified: { type: "boolean" },
            isAmbassador: { type: "boolean" },
            isVerifiedContributor: { type: "boolean" },
            photoUrl: { type: "string", format: "uri", nullable: true },
            points: { type: "integer" },
            quants: { type: "integer" },
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
              enum: [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
              ],
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
            student: { type: "string" },
            courseLabel: { type: "string" },
            title: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
            completed: { type: "boolean" },
            completedAt: { type: "string", format: "date-time" },
          },
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
            thumbnailUrl: { type: "string" },
            fileType: { type: "string", enum: ["pdf", "docx", "pptx"] },
            pageCount: { type: "integer", minimum: 1 },
            validation: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["pending", "clear", "flagged", "manual_required"],
                },
                flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "POTENTIAL_DUPLICATE",
                          "POOR_SCAN_QUALITY",
                          "POSSIBLE_SPLIT_UPLOAD_PATTERN",
                        ],
                      },
                      reason: { type: "string" },
                      matchedDocumentId: { type: "string" },
                      score: { type: "number", format: "float" },
                    },
                  },
                },
                checkedAt: { type: "string", format: "date-time" },
              },
            },
            sizeBytes: { type: "integer" },
            tags: { type: "array", items: { type: "string" } },
            downloadCount: { type: "integer" },
            category: {
              type: "string",
              enum: ["lecture_note", "exam_summary", "past_question", "other"],
            },
            uploadedByType: { type: "string", enum: ["Admin", "Student"] },
            uploadedBy: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "approved", "rejected"],
            },
            pointsAwarded: { type: "integer" },
            reviewedBy: { type: "string" },
            reviewedAt: { type: "string", format: "date-time" },
            rejectionReason: { type: "string" },
          },
        },
        PointsTransaction: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { type: "string" },
            type: {
              type: "string",
              enum: [
                "document_approved",
                "badge_bonus",
                "reward_redeemed",
                "admin_adjustment",
              ],
            },
            amount: {
              type: "integer",
              description: "Positive = earned, negative = spent",
            },
            balanceAfter: { type: "integer" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Badge: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            category: {
              type: "string",
              enum: [
                "upload_milestones",
                "streak_achievements",
                "rank_prestige",
                "special_recognition",
                "social_impact",
              ],
            },
            tier: {
              type: "string",
              enum: [
                "bronze",
                "silver",
                "gold",
                "platinum",
                "diamond",
                "obsidian",
              ],
            },
            points: { type: "integer" },
            earned: { type: "boolean" },
            earnedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        LeaderboardEntry: {
          type: "object",
          properties: {
            rank: { type: "integer" },
            studentId: { type: "string" },
            fullName: { type: "string" },
            points: { type: "integer" },
            materialsUploaded: { type: "integer" },
          },
        },
        Reward: {
          type: "object",
          properties: {
            _id: { type: "string" },
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            type: {
              type: "string",
              enum: ["token_conversion", "voucher", "merchandise"],
            },
            pointsCost: { type: "integer" },
            quantsGranted: { type: "integer" },
            requiresSize: { type: "boolean" },
            sizes: { type: "array", items: { type: "string" } },
          },
        },
        QuantPricing: {
          type: "object",
          description:
            "Cost of one AI reply in quants (₦1 = 1 quant), rounded up and capped at maxPerMessage: perMessage + chars/100 × per100Chars + promptTokens/1000 × per1kInputTokens + completionTokens/1000 × per1kOutputTokens",
          properties: {
            billingEnabled: { type: "boolean" },
            perMessage: { type: "number", example: 4 },
            per100Chars: { type: "number", example: 1 },
            per1kInputTokens: { type: "number", example: 0.3 },
            per1kOutputTokens: { type: "number", example: 1.5 },
            maxPerMessage: { type: "number", example: 40, description: "0 = no cap" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        QuantUsageStats: {
          type: "object",
          description: "Averages over charged chat messages in the last `days` days",
          properties: {
            days: { type: "integer", example: 7 },
            messages: { type: "integer" },
            avgCharged: { type: "integer" },
            avgInputChars: { type: "integer" },
            avgPromptTokens: { type: "integer" },
            avgCompletionTokens: { type: "integer" },
          },
        },
        QuantTransaction: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: {
              description: "Student id, or {_id, fullName, phone, email} on /quants/transactions",
              oneOf: [
                { type: "string" },
                {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    fullName: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                  },
                },
              ],
            },
            type: {
              type: "string",
              enum: ["topup", "chat_message", "reward_conversion", "admin_adjustment"],
            },
            amount: { type: "integer", description: "Positive = credited, negative = spent" },
            balanceAfter: { type: "integer" },
            description: { type: "string" },
            refType: { type: "string", enum: ["Payment", "RewardRedemption"] },
            refId: {
              description: "On /quants/transactions, top-ups carry the populated Payment",
              oneOf: [
                { type: "string" },
                {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    amount: { type: "number", description: "NGN paid" },
                    txRef: { type: "string" },
                    flutterwaveTransactionId: { type: "integer" },
                  },
                },
              ],
            },
            adjustedBy: {
              type: "object",
              nullable: true,
              description: "admin_adjustment only",
              properties: { _id: { type: "string" }, email: { type: "string" } },
            },
            inputChars: { type: "integer", description: "chat_message only" },
            costBreakdown: {
              type: "object",
              description: "chat_message only",
              properties: {
                perMessage: { type: "number" },
                length: { type: "number" },
                aiTokens: { type: "number" },
                total: { type: "integer" },
              },
            },
            groqUsage: {
              type: "object",
              description: "chat_message only",
              properties: {
                promptTokens: { type: "integer" },
                completionTokens: { type: "integer" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        RewardRedemption: {
          type: "object",
          properties: {
            _id: { type: "string" },
            student: { type: "string" },
            reward: { $ref: "#/components/schemas/Reward" },
            pointsCost: { type: "integer" },
            status: { type: "string", enum: ["success", "failed"] },
            selectedSize: { type: "string" },
            voucherCode: { type: "string" },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Announcement: {
          type: "object",
          properties: {
            _id: { type: "string" },
            type: { type: "string", enum: ["lecture_alert", "announcement"] },
            title: { type: "string" },
            message: { type: "string" },
            course: { $ref: "#/components/schemas/Course" },
            timetableSlot: { type: "string" },
            university: { type: "string" },
            department: { type: "string" },
            level: { type: "string" },
            createdByType: { type: "string", enum: ["Student", "Admin"] },
            createdBy: { type: "string" },
            sentAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
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
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Forbidden: {
          description: "Authenticated, but not allowed to perform this action",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        BadRequest: {
          description: "Validation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
