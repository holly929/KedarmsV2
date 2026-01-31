
'use client';

import * as React from 'react';
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { User } from '@/lib/types';
import { useUserData } from '@/context/UserDataContext';
import { EditUserDialog } from '@/components/edit-user-dialog';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useActivityLogDispatch } from '@/context/ActivityLogContext';

const ROWS_PER_PAGE = 10;

export default function UserManagementPage() {
  useRequirePermission();
  const { users, addUser, updateUser, deleteUser, loading } = useUserData();
  const { toast } = useToast();
  const addLog = useActivityLogDispatch();
  
  const [editingUser, setEditingUser] = React.useState<Partial<User> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const isMobile = useIsMobile();

  const totalPages = Math.ceil(users.length / ROWS_PER_PAGE);
  const paginatedUsers = React.useMemo(() => {
    return users.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE
    );
  }, [users, currentPage]);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }
  }, [users.length, currentPage, totalPages]);

  const handleOpenDialog = (user: Partial<User> | null = null) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  }

  const handleSaveUser = (user: Omit<User, 'id'> | User) => {
    if ('id' in user) {
        updateUser(user);
        addLog('Updated User', `Updated user: ${user.email}`);
        toast({ title: 'User Updated', description: `Details for ${user.name} have been updated.` });
    } else {
        addUser(user);
        addLog('Created User', `New user: ${user.email} (${user.role})`);
        toast({ title: 'User Added', description: `${user.name} has been added to the system.` });
    }
  }

  const handleDeleteUser = (user: User) => {
    deleteUser(user.id);
    addLog('Deleted User', `Deleted user: ${user.email}`);
    toast({ variant: 'destructive', title: 'User Deleted', description: `${user.name} has been removed from the system.` });
  }

  const roleVariant = (role: string): 'default' | 'secondary' | 'outline' => {
      switch(String(role).toLowerCase()) {
          case 'admin': return 'default';
          case 'data entry': return 'secondary';
          case 'viewer': return 'outline';
          default: return 'outline';
      }
  }

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  const renderDesktopView = () => (
     <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
        {paginatedUsers.length > 0 ? (
            paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                    <TableCell className="font-medium flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                          <AvatarImage src={user.photoURL} alt={user.name} />
                          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {user.name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                        <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleOpenDialog(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator/>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-destructive hover:bg-destructive/10">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the user account for {user.name}.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user)}>
                                        Yes, delete user
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
            ))
        ) : (
            <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                    No users found.
                </TableCell>
            </TableRow>
        )}
        </TableBody>
    </Table>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedUsers.length > 0 ? paginatedUsers.map(user => (
        <Card key={user.id} className="transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
             <div className="flex items-center gap-4">
                <Avatar>
                    <AvatarImage src={user.photoURL} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-base font-semibold">{user.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 -mt-2">
                  <MoreHorizontal className="h-4 w-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => handleOpenDialog(user)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator/>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-destructive hover:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user account for {user.name}.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(user)}>
                            Yes, delete user
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="border-t pt-4">
             <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-muted-foreground">Role</span>
                <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
            </div>
          </CardContent>
        </Card>
      )) : (
        <div className="text-center text-muted-foreground py-12">
          <p>No users found.</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">User Management</h1>
        <Button onClick={() => handleOpenDialog()} className="self-end sm:self-auto">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
                Manage who can access the system and their permission levels.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isMobile ? renderMobileView() : renderDesktopView()}
        </CardContent>
         {totalPages > 1 && (
            <CardFooter className="flex justify-between items-center border-t pt-4">
            <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({users.length} total users)
            </span>
            <div className="flex items-center gap-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                >
                Previous
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                >
                Next
                </Button>
            </div>
            </CardFooter>
        )}
      </Card>
      <EditUserDialog 
        user={editingUser}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveUser}
      />
    </>
  );
}
