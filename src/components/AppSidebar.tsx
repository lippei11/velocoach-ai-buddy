import { Bike, LayoutDashboard, Calendar, Activity, MessageSquare, Settings, ChevronLeft, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Plan", url: "/plan", icon: Calendar },
  { title: "Activities", url: "/activities", icon: Activity },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Bike className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold text-foreground tracking-tight">
              VeloCoach AI
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent p-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bike className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col text-xs min-w-0">
              <span className="text-foreground font-medium truncate">
                {user?.email ?? "Athlete"}
              </span>
              <button
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive transition-colors text-left flex items-center gap-1"
              >
                <LogOut className="h-3 w-3" />
                Logout
              </button>
            </div>
          </div>
        )}
        {collapsed && (
          <button
            onClick={signOut}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive mx-auto"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent text-muted-foreground mx-auto mt-1"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
