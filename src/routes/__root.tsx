import {
	createRootRoute,
	Link,
	Outlet,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";

const RootLayout = () => {
	const router = useRouter();

	// Get all routes and filter for navigation
	const navRoutes = Object.values(router.routesById)
		.filter((route) => {
			if (route.id === "__root__") return false;

			if (route.id.startsWith("/_")) return false;
			if (route.id.includes("$")) return false;

			const depth = route.id.split("/").filter(Boolean).length;
			const isIndex = route.id.endsWith("/");
			if (isIndex && depth > 0) return false;

			return true;
		})
		.map((route) => ({
			id: route.id,
			path: route.id === "/" ? "/" : route.id.replace(/\/$/, ""),
			label:
				route.id === "/"
					? "Home"
					: route.id
							.split("/")
							.filter(Boolean)
							.map(
								(segment: string) =>
									segment.charAt(0).toUpperCase() + segment.slice(1),
							)
							.join(" "),
		}))
		.sort((a, b) => {
			if (a.path === "/") return -1;
			if (b.path === "/") return 1;
			return a.path.localeCompare(b.path);
		});

	return (
		<div className="px-4 mx-auto max-w-6xl">
			<div className="flex gap-2 px-4 py-4 border-b border-black">
				{navRoutes.map((route, index) => (
					<React.Fragment key={route.id}>
						{index > 0 && "|"}
						<Link to={route.path} className="[&.active]:font-bold">
							{route.label}
						</Link>
					</React.Fragment>
				))}
			</div>

			<div className="p-4">
				<Outlet />
			</div>
			<Toaster />
			<TanStackRouterDevtools />
		</div>
	);
};

export const Route = createRootRoute({ component: RootLayout });
