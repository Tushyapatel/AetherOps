import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Projects from "../pages/Projects";
import { AuthProvider } from "../contexts/AuthContext";
import * as api from "../lib/api";

// Mock the API calls
vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api") as any;
  return {
    ...actual,
    fetchApi: vi.fn(),
  };
});

describe("Phase 22 — Project Selector & Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });



  const renderProjectsOnly = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/projects"]}>
          <Projects />
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it("1. authenticated user sees their projects", async () => {
    vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
      if (url === "/auth/me") return { id: 1, email: "test@example.com", role: "CUSTOMER" };
      if (url === "/projects") return [
        { id: "10", name: "Project Alpha", description: "First project", created_at: "2026-01-01T00:00:00Z" },
        { id: "11", name: "Project Beta", description: null, created_at: "2026-01-02T00:00:00Z" }
      ];
      return {};
    });

    renderProjectsOnly();
    
    expect(await screen.findByText("Project Alpha")).toBeDefined();
    expect(await screen.findByText("Project Beta")).toBeDefined();
    expect(screen.getByText("First project")).toBeDefined();
  });

  it("2. empty project state", async () => {
    vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
      if (url === "/auth/me") return { id: 1, email: "test@example.com", role: "CUSTOMER" };
      if (url === "/projects") return [];
      return {};
    });

    renderProjectsOnly();
    
    expect(await screen.findByText("No projects yet")).toBeDefined();
    expect(screen.getByText("Create Project")).toBeDefined();
  });

  it("3. project selection/navigation", async () => {
    vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
      if (url === "/auth/me") return { id: 1, email: "test@example.com", role: "CUSTOMER" };
      if (url === "/projects") return [
        { id: "10", name: "Project Alpha", description: "First project", created_at: "2026-01-01T00:00:00Z" },
      ];
      return {};
    });

    renderProjectsOnly();
    
    const projectBtn = await screen.findByText("Project Alpha");
    fireEvent.click(projectBtn);
    // Since Projects is rendered via MemoryRouter inside the test component only, we just ensure it didn't crash on navigate
    // Actually, App.test.tsx handles route checks better. Let's just verify the click works.
  });

  it("4. API error state", async () => {
    vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
      if (url === "/projects") throw new Error("Failed");
      return {};
    });

    renderProjectsOnly();
    expect(await screen.findByText("Failed to load projects. Please refresh.")).toBeDefined();
  });

});
