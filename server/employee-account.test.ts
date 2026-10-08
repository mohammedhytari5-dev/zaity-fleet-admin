import { describe, expect, it } from "vitest";
import { employeeAccountLinkError } from "./employee-account";

describe("employee and login account links", () => {
  it("only links active accounts", () => {
    expect(employeeAccountLinkError({ userExists: false, userActive: false, employeeId: 10, linkedEmployeeId: null })).toMatch(/حساب مستخدم نشط/);
    expect(employeeAccountLinkError({ userExists: true, userActive: false, employeeId: 10, linkedEmployeeId: null })).toMatch(/حساب مستخدم نشط/);
  });

  it("does not allow one login account to belong to two employee files", () => {
    expect(employeeAccountLinkError({ userExists: true, userActive: true, employeeId: 10, linkedEmployeeId: 11 })).toMatch(/موظف آخر/);
    expect(employeeAccountLinkError({ userExists: true, userActive: true, employeeId: 10, linkedEmployeeId: 10 })).toBeNull();
    expect(employeeAccountLinkError({ userExists: true, userActive: true, employeeId: 10, linkedEmployeeId: null })).toBeNull();
  });
});
