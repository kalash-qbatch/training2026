export const mockUser = {
  id: "user-test-001",
  fullName: "Jane Doe",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+911234567890",
  passwordHash: "hashed-password",
  role: "USER" as const,
  resetToken: null,
  resetTokenExp: null,
};

export const mockAdmin = {
  id: "admin-test-001",
  fullName: "Admin User",
  name: "Admin User",
  email: "admin@example.com",
  phone: "+919876543210",
  passwordHash: "hashed-password",
  role: "ADMIN" as const,
  resetToken: null,
  resetTokenExp: null,
};

export const validSignUpPayload = {
  fullName: "John Smith",
  email: "john@example.com",
  mobile: "+911122334455",
  password: "SecurePass1!",
  confirmPassword: "SecurePass1!",
};

export const validLoginPayload = {
  email: "john@example.com",
  password: "SecurePass1!",
};
